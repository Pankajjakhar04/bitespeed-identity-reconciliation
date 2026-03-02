import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

type Contact = Prisma.ContactGetPayload<Record<string, never>>;

const LinkPrecedence = {
  primary: "primary" as const,
  secondary: "secondary" as const,
};

export interface IdentifyInput {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface IdentifyResponse {
  contact: {
    primaryContatctId: number; // intentional typo — matches the spec
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

// Fetch the full cluster of contacts linked to the given set of contacts
async function fetchCluster(contacts: Contact[]): Promise<Contact[]> {
  const primaryIds = new Set<number>();

  for (const c of contacts) {
    if (c.linkPrecedence === LinkPrecedence.primary) {
      primaryIds.add(c.id);
    } else if (c.linkedId !== null) {
      primaryIds.add(c.linkedId);
    }
  }

  if (primaryIds.size === 0) return contacts;

  const cluster = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: { in: [...primaryIds] } },
        { linkedId: { in: [...primaryIds] } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return cluster;
}

// Return the oldest primary contact in the cluster
function findOldestPrimary(contacts: Contact[]): Contact {
  const primaries = contacts.filter(
    (c) => c.linkPrecedence === LinkPrecedence.primary
  );
  return primaries.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )[0];
}

// Build the response payload — primary contact's email/phone come first
function buildResponse(cluster: Contact[], primary: Contact): IdentifyResponse {
  const secondaries = cluster.filter(
    (c) => c.id !== primary.id && c.linkPrecedence === LinkPrecedence.secondary
  );

  const emails: string[] = [];
  if (primary.email) emails.push(primary.email);
  for (const c of secondaries) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
  }

  const phoneNumbers: string[] = [];
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
  for (const c of secondaries) {
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber))
      phoneNumbers.push(c.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map((c) => c.id),
    },
  };
}

export async function identifyContact(
  input: IdentifyInput
): Promise<IdentifyResponse> {
  const { email, phoneNumber } = input;

  const orConditions: { email?: string; phoneNumber?: string }[] = [];
  if (email) orConditions.push({ email });
  if (phoneNumber) orConditions.push({ phoneNumber });

  // Find all contacts matching the provided email or phoneNumber
  const directMatches = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: orConditions,
    },
    orderBy: { createdAt: "asc" },
  });

  // No existing contact — create a new primary
  if (directMatches.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkPrecedence: LinkPrecedence.primary,
        linkedId: null,
      },
    });
    return buildResponse([newContact], newContact);
  }

  let cluster = await fetchCluster(directMatches);

  // If the request bridges two separate clusters, merge them — oldest primary wins
  const primaries = cluster.filter(
    (c) => c.linkPrecedence === LinkPrecedence.primary
  );

  if (primaries.length > 1) {
    const oldest = findOldestPrimary(primaries);
    const demoted = primaries.filter((p) => p.id !== oldest.id);

    await Promise.all(
      demoted.map(async (p) => {
        // Re-parent secondaries of the demoted primary
        await prisma.contact.updateMany({
          where: { linkedId: p.id, deletedAt: null },
          data: { linkedId: oldest.id },
        });

        // Demote the extra primary to secondary
        await prisma.contact.update({
          where: { id: p.id },
          data: {
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: oldest.id,
            updatedAt: new Date(),
          },
        });
      })
    );

    cluster = await fetchCluster([oldest]);
  }

  const primary = findOldestPrimary(cluster);

  // If the request contains new information, create a secondary contact
  const exactMatch = cluster.some(
    (c) =>
      c.email === (email ?? null) &&
      c.phoneNumber === (phoneNumber ?? null)
  );

  const hasNewInfo =
    !exactMatch &&
    ((email && !cluster.some((c) => c.email === email)) ||
      (phoneNumber && !cluster.some((c) => c.phoneNumber === phoneNumber)));

  if (hasNewInfo) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: primary.id,
        linkPrecedence: LinkPrecedence.secondary,
      },
    });
    cluster.push(newSecondary);
  }

  return buildResponse(cluster, primary);
}
