// Firebase Admin → PostgreSQL (Prisma) bridge
// All existing imports of `adminDb` and `admin` continue to work.
import { prisma } from "@/lib/prisma";

export const adminDb = prisma;
export default { firestore: { FieldValue: { serverTimestamp: () => new Date(), increment: (n) => n } } };
