/**
 * ShopFinder — Owner Profile Atomic Upsert Hook
 * Phase 6, Task 6.7 Corrective Task
 *
 * Implements private internal route for atomic owner profile updates using
 * PocketBase's native SQLite transactions ($app.runInTransaction).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Restricted exclusively to Superusers via $apis.requireSuperuserAuth().
 * 2. Inaccessible to anonymous and ordinary authenticated users (HTTP 401/403).
 * 3. Derives ownerId from the trusted Express server request, validating role and status.
 * 4. Executes all operations inside $app.runInTransaction using txApp exclusively.
 * 5. Guarantees complete ACID atomicity and rollback across users and owner_contacts.
 */

routerAdd("POST", "/api/custom/owner/profile-upsert", (e) => {
  const body = e.requestInfo().body || {};
  const ownerId = body.ownerId ? String(body.ownerId).trim() : "";
  const name = body.name !== undefined && body.name !== null ? String(body.name).trim() : null;
  const phone = body.phone !== undefined && body.phone !== null ? String(body.phone).trim() : null;
  let files = [];
  try {
    if (typeof e.findUploadedFiles === "function") {
      files = e.findUploadedFiles("avatar") || [];
    }
  } catch {
    files = [];
  }
  const avatarFile = (files && files.length > 0) ? files[0] : null;

  if (!ownerId) {
    throw new BadRequestError("ownerId is required.");
  }

  const hasName = name !== null && name !== "";
  const hasPhone = phone !== null && phone !== "";
  const hasAvatar = Boolean(avatarFile);

  if (!hasName && !hasPhone && !hasAvatar) {
    throw new BadRequestError("At least one field must be provided for update.");
  }

  let result = null;

  $app.runInTransaction((txApp) => {
    // 1. Validate target owner record exists and has role 'owner'
    let userRecord = null;
    try {
      userRecord = txApp.findRecordById("users", ownerId);
    } catch (err) {
      throw new NotFoundError("Owner account not found.");
    }

    if (!userRecord || userRecord.get("role") !== "owner") {
      throw new BadRequestError("Target user is not an authorized commercial owner.");
    }

    if (userRecord.get("is_active") === false) {
      throw new BadRequestError("Owner account is deactivated.");
    }

    // 2. Apply permitted users modifications
    let userModified = false;
    if (hasName) {
      userRecord.set("name", name);
      userModified = true;
    }
    if (hasAvatar) {
      userRecord.set("avatar", avatarFile);
      userModified = true;
    }
    if (userModified) {
      txApp.save(userRecord);
    }

    // 3. Atomically upsert contact phone into owner_contacts
    let contactRecord = null;
    if (hasPhone) {
      try {
        contactRecord = txApp.findFirstRecordByFilter("owner_contacts", "owner = {:owner}", { owner: ownerId });
      } catch (err) {
        contactRecord = null;
      }

      if (contactRecord) {
        contactRecord.set("phone", phone);
        txApp.save(contactRecord);
      } else {
        const contactsCol = txApp.findCollectionByNameOrId("owner_contacts");
        const newContact = new Record(contactsCol);
        newContact.set("owner", ownerId);
        newContact.set("phone", phone);
        txApp.save(newContact);
        contactRecord = newContact;
      }
    } else {
      try {
        contactRecord = txApp.findFirstRecordByFilter("owner_contacts", "owner = {:owner}", { owner: ownerId });
      } catch (err) {
        contactRecord = null;
      }
    }

    // Optional simulation hook for atomicity and rollback verification
    if (body.simulateFailure && String(body.simulateFailure) !== "false") {
      throw new Error("Simulated transactional failure for atomicity test");
    }

    result = {
      id: userRecord.id,
      name: userRecord.get("name") || "",
      email: userRecord.get("email") || "",
      role: userRecord.get("role") || "owner",
      avatar: userRecord.get("avatar") || null,
      phone: contactRecord ? contactRecord.get("phone") : null,
      created: userRecord.get("created"),
      updated: userRecord.get("updated"),
    };
  });

  return e.json(200, {
    success: true,
    data: result,
  });
}, $apis.requireSuperuserAuth());
