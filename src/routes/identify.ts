import { Router, Request, Response, NextFunction } from "express";
import { identifyContact } from "../services/contactService";

const router = Router();

// POST /identify — accepts email and/or phoneNumber, returns consolidated contact
router.post(
  "/identify",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, phoneNumber } = req.body as {
        email?: string;
        phoneNumber?: string | number;
      };

      if (!email && phoneNumber === undefined) {
        res.status(400).json({
          error: "At least one of 'email' or 'phoneNumber' must be provided.",
        });
        return;
      }

      if (email !== undefined && typeof email !== "string") {
        res.status(400).json({ error: "'email' must be a string." });
        return;
      }

      // phoneNumber can arrive as string or number — store as string
      const normalizedPhone =
        phoneNumber !== undefined ? String(phoneNumber) : undefined;

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "Invalid email format." });
        return;
      }

      const result = await identifyContact({
        email: email ?? null,
        phoneNumber: normalizedPhone ?? null,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
