import { PrismaClient } from "../generated/prisma/client";
import { fetchDocument } from "./model/document";

const checkModificationSecret = async (
  prisma: PrismaClient,
  documentId: string,
  modificationSecret: string,
) => {
  const document = await fetchDocument(prisma, documentId);
  return (
    document &&
    document.modificationSecret &&
    document.modificationSecret === modificationSecret
  );
};

export const checkPermission = async (
  prisma: PrismaClient,
  documentId: string,
  modificationSecret: string,
): Promise<boolean> => {
  return !!(await checkModificationSecret(
    prisma,
    documentId,
    modificationSecret,
  ));
};
