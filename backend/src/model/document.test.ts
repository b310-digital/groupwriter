import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteOldDocuments,
  fetchDocument,
  updateLastAccessedAt,
  updateDocument,
  isValidModificationSecret,
  deleteDocument,
  createDocument,
  getDocumentsByOwner,
} from "./document";
import {
  buildExampleDocument,
  createExampleDocument,
} from "../../tests/helpers/documentHelpers";
import { createExampleImage } from "../../tests/helpers/imageHelpers";
import { deleteImage } from "./image";
import { deleteImageFromBucket } from "../utils/s3";
import { PrismaClient } from "../../generated/prisma";
import { createMockPrismaClient } from "../../tests/helpers/mockPrisma";

vi.mock("./image");
vi.mock("../utils/s3");

let prisma: PrismaClient;

beforeEach(() => {
  prisma = createMockPrismaClient();
});

describe("deleteOldDocuments", () => {
  it("should delete old documents, but keep new documents", async () => {
    const cutOffDays = 731;
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - cutOffDays);

    await createExampleDocument(prisma, oldDate);
    const newDocument = await createExampleDocument(prisma);

    const beforeDocuments = await prisma.document.findMany();
    expect(beforeDocuments.length).toEqual(2);

    await deleteOldDocuments(prisma);

    const afterDocuments = await prisma.document.findMany();

    expect(afterDocuments.length).toEqual(1);
    expect(afterDocuments[0].id).toEqual(newDocument.id);
  });

  it("should delete linked images", async () => {
    const cutOffDays = 731;
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - cutOffDays);

    const document = await createExampleDocument(prisma, oldDate);
    const image = await createExampleImage(prisma, document.id);
    vi.mocked(deleteImage).mockResolvedValue(image);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(null);

    await deleteOldDocuments(prisma);
    expect(deleteImage).toHaveBeenCalledWith(prisma, image.id);
    expect(deleteImageFromBucket).toHaveBeenCalledWith(image.id);
  });
});

describe("deleteDocument", () => {
  it("should delete the document", async () => {
    const newDocument = await createExampleDocument(prisma);
    expect(
      await deleteDocument(
        prisma,
        newDocument.id,
        newDocument.modificationSecret,
      ),
    ).toBeTruthy();

    const afterDocument = await prisma.document.findFirst({
      where: { id: newDocument.id },
    });
    expect(afterDocument).toEqual(null);
  });

  it("should delete linked images", async () => {
    const newDocument = await createExampleDocument(prisma);
    const image = await createExampleImage(prisma, newDocument.id);
    vi.mocked(deleteImage).mockResolvedValue(image);
    vi.mocked(deleteImageFromBucket).mockResolvedValue(null);
    expect(
      await deleteDocument(
        prisma,
        newDocument.id,
        newDocument.modificationSecret,
      ),
    ).toBeTruthy();

    expect(deleteImage).toHaveBeenCalledWith(prisma, image.id);
    expect(deleteImageFromBucket).toHaveBeenCalledWith(image.id);
  });

  it("should not delete the document if the id is missing", async () => {
    const newDocument = await createExampleDocument(prisma);
    expect(
      await deleteDocument(prisma, "missing", newDocument.modificationSecret),
    ).toBeFalsy();

    const afterDocument = await prisma.document.findFirst({
      where: { id: newDocument.id },
    });
    expect(afterDocument).toEqual(newDocument);
  });

  it("should not delete the document if the modificationSecret is wrong", async () => {
    const newDocument = await createExampleDocument(prisma);
    expect(await deleteDocument(prisma, newDocument.id, "missing")).toBeFalsy();

    const afterDocument = await prisma.document.findFirst({
      where: { id: newDocument.id },
    });
    expect(afterDocument).toEqual(newDocument);
  });
});

describe("updateLastAccessedAt", () => {
  it("updates the lastAccesseAt value", async () => {
    const document = await prisma.document.create({
      data: buildExampleDocument(),
    });
    // wait a short moment before updating the date:
    await new Promise((r) => setTimeout(r, 10));
    await updateLastAccessedAt(prisma, document.id);

    const updatedDocument = await prisma.document.findFirst({
      where: { id: document.id },
    });
    expect(updatedDocument.lastAccessedAt.valueOf()).toBeGreaterThan(
      document.lastAccessedAt.valueOf(),
    );
  });

  it("does not update the value for an invalid document id", async () => {
    expect(await updateLastAccessedAt(prisma, "invalid")).toBeFalsy();
  });
});

describe("fetchDocument", () => {
  it("accepts a valid uuidv4", async () => {
    const document = await createExampleDocument(prisma);
    expect((await fetchDocument(prisma, document.id)).id).toEqual(document.id);
  });

  it("does not accept an invalid document id", async () => {
    expect(await fetchDocument(prisma, "invalid")).toBeNull();
  });

  it("returns null if the document does not exist", async () => {
    await expect(
      fetchDocument(prisma, crypto.randomUUID()),
    ).resolves.toBeNull();
  });
});

describe("isValidModificationSecret", () => {
  it("returns true for valid modificationSecret", async () => {
    const document = await createExampleDocument(prisma);
    expect(
      await isValidModificationSecret(
        prisma,
        document.id,
        document.modificationSecret,
      ),
    ).toBeTruthy();
  });

  it("returns false for invalid modificationSecret", async () => {
    const document = await createExampleDocument(prisma);
    expect(
      await isValidModificationSecret(prisma, document.id, "invalid"),
    ).toBeFalsy();
  });

  it("does not accept an invalid document id", async () => {
    expect(
      await isValidModificationSecret(prisma, "invalid", "invalid"),
    ).toBeFalsy();
  });
});

describe("updateDocument", () => {
  it("updates an existing document", async () => {
    const document = await createExampleDocument(prisma);
    const newData = new TextEncoder().encode("new");
    expect(await updateDocument(prisma, document.id, newData)).toBeTruthy();
  });

  it("returns false when document does not exist", async () => {
    const document = buildExampleDocument();
    expect(
      await updateDocument(
        prisma,
        "00000000-0000-0000-0000-000000000000",
        document.data,
      ),
    ).toBeFalsy();
  });

  it("does not accept an invalid document id", async () => {
    expect(await updateDocument(prisma, "invalid", undefined)).toBeFalsy();
  });
});

describe("document ownership", () => {
  describe("createDocument", () => {
    it("assigns ownerExternalId when passed", async () => {
      const doc = await createDocument(prisma, "owner-123");

      expect(doc.ownerExternalId).toBe("owner-123");
    });

    it("sets ownerExternalId to null when null is passed", async () => {
      const doc = await createDocument(prisma, null);

      expect(doc.ownerExternalId).toBeNull();
    });
  });

  describe("getDocumentsByOwner", () => {
    it("returns only documents with matching ownerExternalId in the correct order", async () => {
      const ownerA = "owner-A";
      const ownerB = "owner-B";

      const a1 = await createDocument(prisma, ownerA);
      const a2 = await createDocument(prisma, ownerA);

      await createDocument(prisma, ownerB);

      const docs = await getDocumentsByOwner(prisma, ownerA);

      expect(docs.length).toBe(2);
      expect(docs.map(d => d.id)).toEqual([a1.id, a2.id]);
    });

    it("returns an empty list if owner has no documents", async () => {
      const docs = await getDocumentsByOwner(prisma, "owner-234");

      expect(docs).toEqual([]);
    });

    it("returns an empty list if ownerExternalId is null", async () => {
      const docs = await getDocumentsByOwner(prisma, null);

      expect(docs).toEqual([]);
    });   
  });
});