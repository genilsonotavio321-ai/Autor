import "fake-indexeddb/auto";

import { beforeEach, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";

import { attachmentRepository } from "./dexie-attachment-repository";

const DATA_URL = "data:image/jpeg;base64,zzz";

beforeEach(async () => {
  await ensureDbReady();
  await getDatabase().attachments.clear();
});

it("adds and lists attachments per entity, ordered by creation", async () => {
  const first = await attachmentRepository.add({
    projectId: "p1",
    entityType: "note",
    entityId: "n1",
    dataUrl: `${DATA_URL}1`,
    name: "a.jpg",
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await attachmentRepository.add({
    projectId: "p1",
    entityType: "note",
    entityId: "n1",
    dataUrl: `${DATA_URL}2`,
  });
  await attachmentRepository.add({
    projectId: "p1",
    entityType: "character",
    entityId: "c1",
    dataUrl: `${DATA_URL}3`,
  });

  const list = await attachmentRepository.listByEntity("note", "n1");
  expect(list.map((attachment) => attachment.id)).toEqual([
    first.id,
    second.id,
  ]);
  expect(list[0]?.name).toBe("a.jpg");
  expect(await attachmentRepository.listByEntity("event", "n1")).toHaveLength(
    0,
  );
});

it("removes one attachment by id", async () => {
  const attachment = await attachmentRepository.add({
    projectId: "p1",
    entityType: "lore",
    entityId: "l1",
    dataUrl: DATA_URL,
  });

  await attachmentRepository.remove(attachment.id);

  expect(await attachmentRepository.listByEntity("lore", "l1")).toHaveLength(
    0,
  );
});

it("removes every attachment of an entity without touching siblings", async () => {
  await attachmentRepository.add({
    projectId: "p1",
    entityType: "location",
    entityId: "loc1",
    dataUrl: DATA_URL,
  });
  await attachmentRepository.add({
    projectId: "p1",
    entityType: "location",
    entityId: "loc2",
    dataUrl: DATA_URL,
  });

  await attachmentRepository.removeByEntityId("loc1");

  expect(
    await attachmentRepository.listByEntity("location", "loc1"),
  ).toHaveLength(0);
  expect(
    await attachmentRepository.listByEntity("location", "loc2"),
  ).toHaveLength(1);
});

it("removes every attachment of a project", async () => {
  await attachmentRepository.add({
    projectId: "p1",
    entityType: "note",
    entityId: "n1",
    dataUrl: DATA_URL,
  });
  await attachmentRepository.add({
    projectId: "p2",
    entityType: "event",
    entityId: "e1",
    dataUrl: DATA_URL,
  });

  await attachmentRepository.removeByProject("p1");

  expect(await attachmentRepository.listByProject("p1")).toHaveLength(0);
  expect(await attachmentRepository.listByProject("p2")).toHaveLength(1);
});
