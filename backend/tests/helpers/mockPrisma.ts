import { randomUUID } from "crypto";
import { vi } from "vitest";
import type { PrismaClient, Document, Image, Prisma } from "../../generated/prisma";

type DocumentStore = Document[];
type ImageStore = Image[];

interface MockPrismaClientWithReset extends PrismaClient {
  $reset: () => void;
}

function matchesFilter<T extends Record<string, unknown>>(
  item: T,
  where?: Record<string, unknown>,
): boolean {
  if (!where) return true;

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      if (!value.every((clause) => matchesFilter(item, clause as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    if (key === "OR" && Array.isArray(value)) {
      if (!value.some((clause) => matchesFilter(item, clause as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    if (key === "NOT") {
      if (matchesFilter(item, value as Record<string, unknown>)) {
        return false;
      }
      continue;
    }

    // Skip relation filters
    if (key === "images" || key === "document") continue;

    const itemValue = item[key];

    // Handle Prisma filter objects (e.g., { lt: Date })
    if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Uint8Array)) {
      const filterObj = value as Record<string, unknown>;
      if ("lt" in filterObj) {
        const ltValue = filterObj.lt;
        if (ltValue instanceof Date && itemValue instanceof Date) {
          if (itemValue >= ltValue) return false;
        }
        continue;
      }
      if ("gt" in filterObj) {
        const gtValue = filterObj.gt;
        if (gtValue instanceof Date && itemValue instanceof Date) {
          if (itemValue <= gtValue) return false;
        }
        continue;
      }
      if ("equals" in filterObj) {
        if (itemValue !== filterObj.equals) return false;
        continue;
      }
    }

    // Direct equality check
    if (itemValue !== value) return false;
  }

  return true;
}

function applyOrderBy<T extends Record<string, unknown>>(
  items: T[],
  orderBy?: Record<string, string> | Record<string, string>[],
): T[] {
  if (!orderBy) return items;

  const orderByArr = Array.isArray(orderBy) ? orderBy : [orderBy];
  const result = [...items];

  for (const order of orderByArr.reverse()) {
    const [field, direction] = Object.entries(order)[0];
    result.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal instanceof Date && bVal instanceof Date) {
        return direction === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }

  return result;
}

export function createMockPrismaClient(): MockPrismaClientWithReset {
  let documents: DocumentStore = [];
  let images: ImageStore = [];

  const createDocument = (data: Prisma.DocumentCreateInput = {}): Document => {
    const now = new Date();
    return {
      id: data.id ?? randomUUID(),
      modificationSecret: data.modificationSecret ?? randomUUID(),
      ownerExternalId: data.ownerExternalId ?? null,
      data: data.data ?? null,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : now,
      lastAccessedAt: data.lastAccessedAt ? new Date(data.lastAccessedAt) : now,
    };
  };

  const createImage = (data: Prisma.ImageCreateInput | Prisma.ImageUncheckedCreateInput): Image => {
    const now = new Date();
    // Handle both checked (document relation) and unchecked (documentId) create patterns
    const documentId = "documentId" in data
      ? data.documentId
      : (data as Prisma.ImageCreateInput).document?.connect?.id as string;
    return {
      id: randomUUID(),
      name: data.name,
      mimetype: data.mimetype,
      documentId,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : now,
    };
  };

  const documentDelegate = {
    create: vi.fn(async (args: { data: Prisma.DocumentCreateInput }) => {
      const doc = createDocument(args.data);
      documents.push(doc);
      return doc;
    }),

    findFirst: vi.fn(async (args?: Prisma.DocumentFindFirstArgs) => {
      const found = documents.find((doc) => matchesFilter(doc, args?.where as Record<string, unknown>));
      if (!found) return null;
      if (args?.include?.images) {
        return { ...found, images: images.filter((i) => i.documentId === found.id) };
      }
      return found;
    }),

    findUnique: vi.fn(async (args?: Prisma.DocumentFindUniqueArgs) => {
      const found = documents.find((doc) => matchesFilter(doc, args?.where as Record<string, unknown>));
      if (!found) return null;
      if (args?.include?.images) {
        return { ...found, images: images.filter((i) => i.documentId === found.id) };
      }
      return found;
    }),

    findMany: vi.fn(async (args?: Prisma.DocumentFindManyArgs) => {
      let result = documents.filter((doc) => matchesFilter(doc, args?.where as Record<string, unknown>));
      result = applyOrderBy(result, args?.orderBy as Record<string, string> | Record<string, string>[]);
      if (args?.include?.images) {
        return result.map((doc) => ({
          ...doc,
          images: images.filter((i) => i.documentId === doc.id),
        }));
      }
      return result;
    }),

    update: vi.fn(async (args: Prisma.DocumentUpdateArgs) => {
      const index = documents.findIndex((doc) => matchesFilter(doc, args.where as Record<string, unknown>));
      if (index === -1) throw new Error("Record not found");
      const updateData = args.data as Partial<Document>;
      documents[index] = { ...documents[index], ...updateData, updatedAt: new Date() };
      return documents[index];
    }),

    delete: vi.fn(async (args: Prisma.DocumentDeleteArgs) => {
      const index = documents.findIndex((doc) => matchesFilter(doc, args.where as Record<string, unknown>));
      if (index === -1) throw new Error("Record not found");
      const deleted = documents[index];
      documents.splice(index, 1);
      return deleted;
    }),

    deleteMany: vi.fn(async (args?: Prisma.DocumentDeleteManyArgs) => {
      const toDelete = documents.filter((doc) => matchesFilter(doc, args?.where as Record<string, unknown>));
      documents = documents.filter((doc) => !matchesFilter(doc, args?.where as Record<string, unknown>));
      return { count: toDelete.length };
    }),
  };

  const imageDelegate = {
    create: vi.fn(async (args: { data: Prisma.ImageCreateInput | Prisma.ImageUncheckedCreateInput }) => {
      const img = createImage(args.data);
      images.push(img);
      return img;
    }),

    findFirst: vi.fn(async (args?: Prisma.ImageFindFirstArgs) => {
      return images.find((img) => matchesFilter(img, args?.where as Record<string, unknown>)) ?? null;
    }),

    findUnique: vi.fn(async (args?: Prisma.ImageFindUniqueArgs) => {
      return images.find((img) => matchesFilter(img, args?.where as Record<string, unknown>)) ?? null;
    }),

    findMany: vi.fn(async (args?: Prisma.ImageFindManyArgs) => {
      return images.filter((img) => matchesFilter(img, args?.where as Record<string, unknown>));
    }),

    update: vi.fn(async (args: Prisma.ImageUpdateArgs) => {
      const index = images.findIndex((img) => matchesFilter(img, args.where as Record<string, unknown>));
      if (index === -1) throw new Error("Record not found");
      const updateData = args.data as Partial<Image>;
      images[index] = { ...images[index], ...updateData, updatedAt: new Date() };
      return images[index];
    }),

    delete: vi.fn(async (args: Prisma.ImageDeleteArgs) => {
      const index = images.findIndex((img) => matchesFilter(img, args.where as Record<string, unknown>));
      if (index === -1) throw new Error("Record not found");
      const deleted = images[index];
      images.splice(index, 1);
      return deleted;
    }),

    deleteMany: vi.fn(async (args?: Prisma.ImageDeleteManyArgs) => {
      const toDelete = images.filter((img) => matchesFilter(img, args?.where as Record<string, unknown>));
      images = images.filter((img) => !matchesFilter(img, args?.where as Record<string, unknown>));
      return { count: toDelete.length };
    }),
  };

  return {
    document: documentDelegate,
    image: imageDelegate,
    $reset: () => {
      documents = [];
      images = [];
    },
  } as unknown as MockPrismaClientWithReset;
}
