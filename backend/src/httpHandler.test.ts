import { IncomingMessage, ServerResponse } from "http";
import { PrismockClient } from "prismock";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import {
  handleCreateDocumentRequest,
  handleDeleteDocumentRequest,
  handleDeleteImageRequest,
  handleGetImageRequest,
  handleUploadImageRequest,
  handleGetOwnDocumentsRequest
} from "./httpHandler";
import { Document } from "@prisma/client";
import { downloadEncryptedImage } from "./utils/uploaderDownloader";
import { deleteImageFromBucket } from "./utils/s3";
import { DeleteObjectCommandOutput } from "@aws-sdk/client-s3";
const prisma = new PrismockClient();

vi.mock("stream/promises");
vi.mock("./utils/uploaderDownloader");
vi.mock("./utils/s3");
vi.mock("formidable", () => ({
  default: () => {
    return {
      parse: vi.fn().mockResolvedValue([
        {},
        {
          file: [
            {
              filepath: "test",
              mimetype: "image/png",
              originalFilename: "test.png",
            },
          ],
        },
      ]),
    };
  },
}));

// Note: Usually reset should be called, but there seems to be a type bug currently
// See https://github.com/morintd/prismock/issues/871
// prisma.reset();

describe("handleCreateDocumentRequest", () => {
  it("creates a document without owner", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prisma, null);
    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result.id).toBeDefined();
    expect(result.ownerExternalId).toBeNull();
  });
  it("creates a document with owner", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    await handleCreateDocumentRequest(response, prisma, "123");
    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result.id).toBeDefined();
    expect(result.ownerExternalId).toEqual("123");
  });
});

describe("handleGetOwnDocumentsRequest", () => {
  it("returns empty list when no ownerId is provided", async () => {
    await prisma.document.create({ data: {ownerExternalId:"owner-123"} });
    await prisma.document.create({ data: {ownerExternalId:null} });
    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prisma, null);
    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document;
    expect(result).toEqual([]);
  })
  it("returns list when ownerId is provided", async () => {
    const document = await prisma.document.create({ data: { ownerExternalId : "owner-234" } });
    const response = mock<ServerResponse<IncomingMessage>>();
    await handleGetOwnDocumentsRequest(response, prisma, "owner-234");
    const result = JSON.parse(
      response.end.mock.calls[0][0] as string,
    ) as Document[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(document.id);
  })
})

describe("handleDeleteDocumentRequest", () => {
  it("deletes a document", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    const document = await prisma.document.create({ data: {} });
    await handleDeleteDocumentRequest(
      document.id,
      document.modificationSecret,
      response,
      prisma,
    );
    expect(response.writeHead.mock.calls[0][0]).toBe(200);
    expect(
      await prisma.document.findFirst({ where: { id: document.id } }),
    ).toBeNull();
  });

  it("does not delete a document when secret is wrong", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    const document = await prisma.document.create({ data: {} });
    await handleDeleteDocumentRequest(document.id, "test", response, prisma);
    expect(response.writeHead.mock.calls[0][0]).toBe(404);
  });
});

describe("handleUploadImageRequest", () => {
  it("uploads an image", async () => {
    const document = await prisma.document.create({ data: {} });
    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await handleUploadImageRequest(
      document.id,
      document.modificationSecret,
      request,
      response,
      prisma,
    );
    expect(response.writeHead.mock.calls[0][0]).toBe(200);
    expect(response.end.mock.calls[0][0]).toContain("images/");
  });

  it("does not upload an image when the secret is wrong", async () => {
    const document = await prisma.document.create({ data: {} });
    const response = mock<ServerResponse<IncomingMessage>>();
    const request = mock<IncomingMessage>();
    await expect(
      handleUploadImageRequest(document.id, "wrong", request, response, prisma),
    ).rejects.toBeUndefined();
    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });
});

describe("handleGetImageRequest", () => {
  it("returns an image", async () => {
    const document = await prisma.document.create({ data: {} });
    const image = await prisma.image.create({
      data: {
        mimetype: "image/png",
        name: "test.png",
        documentId: document.id,
      },
    });
    const response = mock<ServerResponse<IncomingMessage>>();
    vi.mocked(downloadEncryptedImage).mockResolvedValue(Buffer.from("test"));
    await handleGetImageRequest(image.id, response, prisma);
    expect(response.writeHead.mock.calls[0][0]).toEqual(200);
    expect(response.writeHead.mock.calls[0][1]).toHaveProperty(
      "Content-Disposition",
      "inline; filename=test.png",
    );
    expect(response.writeHead.mock.calls[0][1]).toHaveProperty(
      "Content-Type",
      "image/png",
    );
  });
});

describe("handleDeleteImageRequest", () => {
  it("creates a document", async () => {
    const response = mock<ServerResponse<IncomingMessage>>();
    const document = await prisma.document.create({ data: {} });
    vi.mocked(deleteImageFromBucket).mockResolvedValue(
      {} as DeleteObjectCommandOutput,
    );
    const image = await prisma.image.create({
      data: {
        mimetype: "image/png",
        name: "test.png",
        documentId: document.id,
      },
    });
    await handleDeleteImageRequest(
      image.id,
      document.modificationSecret,
      response,
      prisma,
    );
    expect(response.writeHead.mock.calls[0][0]).toEqual(204);
  });

  it("does not delete an image when the secret is wrong", async () => {
    const document = await prisma.document.create({ data: {} });
    const response = mock<ServerResponse<IncomingMessage>>();
    vi.mocked(deleteImageFromBucket).mockResolvedValue(
      {} as DeleteObjectCommandOutput,
    );
    await expect(
      handleDeleteImageRequest(document.id, "wrong", response, prisma),
    ).rejects.toBeUndefined();
    expect(response.writeHead.mock.calls[0][0]).toBe(403);
  });
});
