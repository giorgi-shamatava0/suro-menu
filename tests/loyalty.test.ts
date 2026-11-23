import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
const enrollArgs = <T extends { secret: string }>(args: T) => args;
const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/loyalty.ts": () => import("../convex/loyalty"),
  "../convex/auth.ts": () => import("../convex/auth"),
};
async function setup() {
  const t = convexTest(schema, modules);
  const qr = "a".repeat(64);
  const secret = "b".repeat(64);
  const token = "admin-test";
  const memberId = await t.run(async (ctx) => {
    await ctx.db.insert("sessions", {
      token,
      expiresAt: Date.now() + 3600_000,
    });
    return ctx.db.insert("loyaltyMembers", {
      qr,
      secret,
      revoked: false,
      updatedAt: Date.now(),
    });
  });
  const rewardItemId=await t.run(async ctx=>{const sectionId=await ctx.db.insert("sections",{name:{ka:"მენიუ",en:"Menu"},order:0});const categoryId=await ctx.db.insert("categories",{sectionId,name:{ka:"ყავა",en:"Coffee"},order:0});return ctx.db.insert("items",{categoryId,name:{ka:"ყავა",en:"Coffee",ru:"Кофе"},order:0});});
  const programId = await t.mutation(api.loyalty.saveProgram, {
    token,
    name: "Coffee",
    rewardItemId,
    description: "Coffee stamps",
    products: "Coffee",
    reward: "Free coffee",
    threshold: 10,
    expiry: "rolling",
    months: 6,
  });
  await t.mutation(api.loyalty.setStatus, {
    token,
    id: programId,
    status: "active",
  });
  const award = (key: string, count: number, reference = key) =>
    t.mutation(api.loyalty.issue, {
      token,
      qr,
      programId,
      count,
      key,
      reference,
    });
  return { t, qr, secret, token, memberId, programId, rewardItemId, award };
}
test("QR alone cannot authorize lookup, issuance, or private card access", async () => {
  const { t, qr, programId } = await setup();
  await expect(
    t.mutation(api.loyalty.lookup, { token: qr, qr }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.loyalty.issue, {
      token: qr,
      qr,
      programId,
      count: 1,
      key: "x",
      reference: "x",
    }),
  ).rejects.toThrow();
  expect(await t.query(api.loyalty.card, { secret: qr })).toBeNull();
});
test("concurrent duplicate awards are idempotent", async () => {
  const { t, award, secret } = await setup();
  await Promise.all([award("receipt-1", 6), award("receipt-1", 6)]);
  expect(
    (await t.query(api.loyalty.card, { secret }))?.programs[0].stamps,
  ).toBe(6);
  await expect(award("receipt-1", 7)).rejects.toThrow();
});
test("rewards survive stamp expiration and concurrent redemption happens once", async () => {
  const { t, award, secret, token, qr, memberId } = await setup();
  await award("receipt-2", 14);
  await t.run(async (ctx) => {
    const b = await ctx.db.query("loyaltyBalances").first();
    await ctx.db.patch(b!._id, { expiresAt: Date.now() - 1 });
  });
  const card = await t.mutation(api.loyalty.lookup, { token, qr });
  expect(card.programs[0].stamps).toBe(0);
  expect(card.rewards[0].status).toBe("available");
  const args = {
    token,
    qr,
    rewardId: card.rewards[0]._id,
    key: "redeem-1",
    confirmed: true,
  };
  await Promise.all([
    t.mutation(api.loyalty.redeem, args),
    t.mutation(api.loyalty.redeem, args),
  ]);
  expect((await t.query(api.loyalty.card, { secret }))?.rewards[0].status).toBe(
    "redeemed",
  );
  expect(
    (
      await t.run((ctx) =>
        ctx.db
          .query("loyaltyLedger")
          .withIndex("by_member", (q) => q.eq("memberId", memberId))
          .collect(),
      )
    ).filter((t) => t.kind === "redeem"),
  ).toHaveLength(1);
  await expect(
    t.mutation(api.loyalty.redeem, { ...args, key: "redeem-2" }),
  ).rejects.toThrow();
});
test("new programs preserve old progress and rule edits retain in-progress version", async () => {
  const { t, award, token, secret, programId, rewardItemId } = await setup();
  await award("receipt-3", 3);
  await t.mutation(api.loyalty.saveProgram, {
    token,
    id: programId,
    name: "Coffee",
    description: "Updated",
    products: "Coffee",
    reward: "New coffee",
    threshold: 5,
    expiry: "never",
    months: 6,
  });
  await t.mutation(api.loyalty.saveProgram, {
    token,
    name: "Pastry",
    rewardItemId,
    description: "New",
    products: "Pastry",
    reward: "Free pastry",
    threshold: 5,
    expiry: "rolling",
    months: 6,
  });
  const card = await t.query(api.loyalty.card, { secret });
  expect(card?.programs[0]).toMatchObject({ stamps: 3, threshold: 10 });
  expect(card?.rewards).toHaveLength(0);
});
test("revoking a staff record immediately blocks its existing session", async () => {
  const { t, token, qr } = await setup();
  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("loyaltyStaff", {
      name: "barista",
      hash: "unused",
      active: true,
      role: "staff",
    });
    await ctx.db.insert("loyaltySessions", {
      token: "staff-token",
      staffId: id,
      expiresAt: Date.now() + 1000_000,
    });
    return id;
  });
  await t.mutation(api.loyalty.lookup, { token: "staff-token", qr });
  await expect(
    t.query(api.loyalty.dashboard, { token: "staff-token" }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.revokeStaff, { token, id });
  await expect(
    t.mutation(api.loyalty.lookup, { token: "staff-token", qr }),
  ).rejects.toThrow();
});
test("expired rewards cannot be redeemed, and paused programs cannot issue", async () => {
  const { t, award, qr, token, programId } = await setup();
  await award("receipt-4", 10);
  const r = await t.run(async (ctx) => {
    const r = await ctx.db.query("loyaltyRewards").first();
    await ctx.db.patch(r!._id, { expiresAt: Date.now() - 1 });
    return r!;
  });
  await expect(
    t.mutation(api.loyalty.redeem, {
      token,
      qr,
      rewardId: r._id,
      key: "expired-reward",
      confirmed: true,
    }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.setStatus, {
    token,
    id: programId,
    status: "paused",
  });
  await expect(award("receipt-5", 1)).rejects.toThrow();
});
test("enrollment requires server admission and reuses membership without consuming traffic", async () => {
  const {t,memberId}=await setup();
  await t.run(ctx=>ctx.db.delete(memberId));
  process.env.LOYALTY_ADMISSION_SECRET = "test-admission";
  const a = {
    admission: "test-admission",
    bucket: "ip-test",
    secret: "c".repeat(64),
    qr: "d".repeat(64),
  };
  await expect(
    t.mutation(api.loyalty.enroll, enrollArgs({ ...a, admission: "bad" })),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.enroll, enrollArgs(a));
  await t.mutation(api.loyalty.enroll, enrollArgs(a));
  expect(
    await t.run((ctx) => ctx.db.query("loyaltyMembers").collect()),
  ).toHaveLength(1);
  for (let i = 1; i < 5; i++)
    await t.mutation(api.loyalty.enroll, enrollArgs({
      ...a,
      secret: i.toString(16).repeat(64),
      qr: (i + 5).toString(16).repeat(64),
    }));
  await t.mutation(api.loyalty.enroll, enrollArgs({ ...a, secret: "f".repeat(64) }));
  const traffic = await t.run(ctx => ctx.db.query("loyaltyLimits").withIndex("by_key", q => q.eq("key", "signup:hourly")).unique());
  expect(traffic?.count).toBe(6);
  delete process.env.LOYALTY_ADMISSION_SECRET;
});
test("revoked memberships reject staff operations and retain a revoked card view", async () => {
  const { t, token, qr, secret, award } = await setup();
  await t.mutation(api.loyalty.revokeCard, { token, qr, reason: "Lost card" });
  expect((await t.query(api.loyalty.card, { secret }))?.revoked).toBe(true);
  await expect(award("revoked-purchase", 1)).rejects.toThrow();
});
test("fixed stamp expiry preserves later lots instead of extending earlier stamps", async () => {
  const { t, token, qr, secret, programId, award } = await setup();
  await t.mutation(api.loyalty.saveProgram, {
    token,
    id: programId,
    name: "Coffee",
    description: "Fixed",
    products: "Coffee",
    reward: "Coffee",
    threshold: 10,
    expiry: "fixed",
    months: 6,
  });
  await award("fixed-1", 3);
  await t.run(async (ctx) => {
    const lot = await ctx.db.query("loyaltyLots").first();
    const b = await ctx.db.query("loyaltyBalances").first();
    await ctx.db.patch(lot!._id, { expiresAt: Date.now() - 1 });
    await ctx.db.patch(b!._id, { expiresAt: Date.now() - 1 });
    const entries = await ctx.db.query("loyaltyLedger").collect();
    for (const entry of entries)
      await ctx.db.patch(entry._id, { at: Date.now() - 20_000 });
  });
  await award("fixed-2", 2);
  expect(
    (await t.query(api.loyalty.card, { secret }))?.programs[0].stamps,
  ).toBe(2);
  const card = await t.mutation(api.loyalty.lookup, { token, qr });
  expect(card.history.some((t) => t.kind === "expire" && t.count === -3)).toBe(
    true,
  );
});
test("receipt replay remains blocked after intervening purchases", async () => {
  const { t, award } = await setup();
  await award("original-key", 1, "original-receipt");
  await t.run(async (ctx) => {
    const entry = await ctx.db.query("loyaltyLedger").first();
    await ctx.db.patch(entry!._id, { at: Date.now() - 20_000 });
  });
  await expect(award("new-key", 1, "original-receipt")).rejects.toThrow();
});
test("only administrators can cancel rewards and cancellation is idempotent", async () => {
  const { t, award, qr, token } = await setup();
  await award("cancel-purchase", 10);
  const r = await t.run((ctx) => ctx.db.query("loyaltyRewards").first());
  const args = {
    token,
    qr,
    rewardId: r!._id,
    reason: "Incorrect award reviewed by owner",
  };
  await expect(
    t.mutation(api.loyalty.cancelReward, { ...args, token: "not-a-session" }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.cancelReward, args);
  await t.mutation(api.loyalty.cancelReward, args);
  expect((await t.run((ctx) => ctx.db.get(r!._id)))?.status).toBe("cancelled");
  const records = await t.run((ctx) => ctx.db.query("loyaltyLedger").collect());
  expect(records.filter((r) => r.kind === "cancel")).toHaveLength(1);
});
test("stamp corrections require admin authorization and preserve the original transaction", async () => {
  const { t, award, token, secret } = await setup();
  await award("incorrect-purchase", 6);
  const original = await t.run((ctx) => ctx.db.query("loyaltyLedger").first());
  await expect(
    t.mutation(api.loyalty.reverse, {
      token: "invalid",
      transactionId: original!._id,
      reason: "Mistake",
    }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.reverse, {
    token,
    transactionId: original!._id,
    reason: "Incorrect receipt",
  });
  expect(
    (await t.query(api.loyalty.card, { secret }))?.programs[0].stamps,
  ).toBe(0);
  const preserved = await t.run((ctx) => ctx.db.get(original!._id));
  expect(preserved?.count).toBe(6);
  expect(preserved?.reversedBy).toBeTruthy();
});

test("public card is read-only, excludes private details, and follows awards and revocation", async () => {
  const { t, qr, token, award } = await setup();
  expect(await t.query(api.loyalty.publicCard, { code: "invalid" })).toBeNull();
  await award("public-progress", 10);
  const card = await t.query(api.loyalty.publicCard, { code: qr });
  expect(card?.rewards).toHaveLength(1);
  expect(card).not.toHaveProperty("secret");
  expect(card).not.toHaveProperty("serial");
  expect(card).not.toHaveProperty("history");
  await t.mutation(api.loyalty.revokeCard, { token, qr, reason: "Lost" });
  const revoked = await t.query(api.loyalty.publicCard, { code: qr });
  expect(revoked?.revoked).toBe(true);
  expect(revoked?.programs).toEqual([]);
});
test("staff use password only; admin reset revokes sessions and old password", async () => {
  const { t, token, qr } = await setup();
  const oldPassword = "Staff initial passphrase 77";
  const newPassword = "Staff replacement phrase 88";
  await t.action(api.loyalty.addStaff, {
    token,
    name: "Barista label",
    password: oldPassword,
    role: "staff",
  });
  const person = await t.run((ctx) => ctx.db.query("loyaltyStaff").first());
  const staffToken = await t.action(api.loyalty.login, {
    password: oldPassword,
  });
  expect(
    (await t.mutation(api.loyalty.lookup, { token: staffToken, qr })).qr,
  ).toBe(qr);
  await expect(
    t.action(api.loyalty.resetStaffPassword, {
      token: staffToken,
      id: person!._id,
      password: newPassword,
    }),
  ).rejects.toThrow();
  await expect(
    t.action(api.loyalty.addStaff, {
      token,
      name: "Duplicate password",
      password: oldPassword,
      role: "staff",
    }),
  ).rejects.toThrow();
  await t.action(api.loyalty.resetStaffPassword, {
    token,
    id: person!._id,
    password: newPassword,
  });
  await expect(
    t.mutation(api.loyalty.lookup, { token: staffToken, qr }),
  ).rejects.toThrow();
  await expect(
    t.action(api.loyalty.login, { password: oldPassword }),
  ).rejects.toThrow();
  const replacement = await t.action(api.loyalty.login, {
    password: newPassword,
  });
  expect(
    (await t.mutation(api.loyalty.lookup, { token: replacement, qr })).qr,
  ).toBe(qr);
  const { internal } = await import("../convex/_generated/api");
  await expect(
    t.mutation(internal.loyalty.createSession, {
      staffId: person!._id,
      token: "raced-session",
      expectedHash: person!.hash,
    }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.revokeStaff, { token, id: person!._id });
  await expect(
    t.action(api.loyalty.login, { password: newPassword }),
  ).rejects.toThrow();
});
test("only admin can edit terms and public cards receive exactly the saved text", async () => {
  const { t, token, qr } = await setup();
  const terms = {
    ka: "პირობები\nმეორე ხაზი",
    en: "Terms\nSecond line",
    ru: "Условия",
  };
  await expect(
    t.mutation(api.loyalty.saveTerms, { token: "invalid", terms }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.saveTerms, { token, terms });
  const card = await t.query(api.loyalty.publicCard, { code: qr });
  expect(card).toHaveProperty("terms", terms);
  expect(card).not.toHaveProperty("secret");
  await expect(
    t.mutation(api.loyalty.saveTerms, {
      token,
      terms: { ...terms, en: "x".repeat(12001) },
    }),
  ).rejects.toThrow();
});
test("public card exposes the menu reward photo and description without changing balances", async () => {
  const { t, token, qr, programId, rewardItemId, award } = await setup();
  await award("photo-stamps", 2);
  const image = await t.run((ctx) =>
    ctx.storage.store(
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    ),
  );
  await t.run(ctx=>ctx.db.patch(rewardItemId,{photo:image,description:{en:"Menu reward description"}}));
  await t.mutation(api.loyalty.saveProgram, {
    token,
    id: programId,
    name: "Coffee",
    description: "Coffee stamps",
    products: "Coffee",
    reward: "Free coffee",
    rewardImage: image,
    threshold: 10,
    expiry: "rolling",
    months: 6,
  });
  const card = await t.query(api.loyalty.publicCard, { code: qr });
  expect(card?.programs[0].stamps).toBe(2);
  expect(card?.programs[0].rewardImageUrl).toBe(await t.run(ctx => ctx.storage.getUrl(image)));
  expect(card?.programs[0].rewardDescriptions).toEqual({en:"Menu reward description"});
  const unsafe = await t.run((ctx) =>
    ctx.storage.store(new Blob(["<svg/>"], { type: "image/svg+xml" })),
  );
  await expect(
    t.mutation(api.loyalty.saveProgram, {
      token,
      id: programId,
      name: "Coffee",
      description: "Coffee stamps",
      products: "Coffee",
      reward: "Free coffee",
      rewardImage: unsafe,
      threshold: 10,
      expiry: "rolling",
      months: 6,
    }),
  ).rejects.toThrow();
});

test("short public card identifiers preserve progress and still require staff authorization",async()=>{
 const {t,token,qr,memberId,programId}=await setup();const code="abCdEfGhIjKlMnOpQrStUv";
 await t.run(ctx=>ctx.db.patch(memberId,{publicCode:code}));
 expect(await t.query(api.loyalty.publicCard,{code})).toHaveProperty("publicCode",code);
 await expect(t.mutation(api.loyalty.lookup,{token:code,qr:code})).rejects.toThrow();
 await t.mutation(api.loyalty.issue,{token,qr:code,programId,count:2,key:"short-stamps",reference:"short-receipt"});
 expect((await t.query(api.loyalty.publicCard,{code}))?.programs[0].stamps).toBe(2);
 expect((await t.query(api.loyalty.publicCard,{code:qr}))?.programs[0].stamps).toBe(2);
});

test("reward names and photos come only from a selected menu item with all translations",async()=>{
 const {t,token,qr,rewardItemId}=await setup();
 const names={ka:"ყავა მენიუდან",en:"Menu coffee",ru:"Кофе из меню"};
 await t.run(ctx=>ctx.db.patch(rewardItemId,{name:names}));
 expect((await t.query(api.loyalty.publicCard,{code:qr}))?.programs[0].rewardNames).toEqual(names);
 await expect(t.mutation(api.loyalty.saveProgram,{token,name:"Invalid free text",description:"",products:"Coffee",reward:"Invented item",threshold:8,expiry:"rolling",months:6})).rejects.toThrow();
});

test('welcome awards exactly two real stamps once, including concurrent enrollment', async()=>{
 const {t}=await setup(); process.env.LOYALTY_ADMISSION_SECRET='welcome-test';
 const args={admission:'welcome-test',bucket:'welcome-ip',secret:'1'.repeat(64),qr:'2'.repeat(64)};
 const results=await Promise.all([t.mutation(api.loyalty.enroll, enrollArgs(args)),t.mutation(api.loyalty.enroll, enrollArgs(args))]);
 if(!results[0].ok || !results[1].ok) throw new Error("Enrollment failed");
 expect(results[0].code).toBe(results[1].code);
 expect((await t.query(api.loyalty.publicCard,{code:results[0].code}))?.programs[0].stamps).toBe(2);
 const ledger=await t.run(ctx=>ctx.db.query('loyaltyLedger').collect());
 expect(ledger.filter(r=>r.key.startsWith('welcome:'))).toHaveLength(2);
 const member=await t.run(ctx=>ctx.db.query('loyaltyMembers').withIndex('by_secret',q=>q.eq('secret',args.secret)).unique());
 expect(member?.consentVersion).toBe('2026-11-23');
 delete process.env.LOYALTY_ADMISSION_SECRET;
});


test('legacy loyalty-admin staff sessions cannot manage the application', async()=>{
 const {t}=await setup();await t.run(async ctx=>{const id=await ctx.db.insert('loyaltyStaff',{name:'legacy',hash:'unused',role:'admin',active:true});await ctx.db.insert('loyaltySessions',{token:'legacy-token',staffId:id,expiresAt:Date.now()+100000})});
 await expect(t.query(api.loyalty.dashboard,{token:'legacy-token'})).rejects.toThrow();
});

test('staff can stamp but cannot redeem rewards or administer cards',async()=>{
 const {t,award,token,qr,programId}=await setup();await award('reward-for-staff-check',10);
 const reward=await t.run(ctx=>ctx.db.query('loyaltyRewards').first());
 await t.run(async ctx=>{
  const id=await ctx.db.insert('loyaltyStaff',{name:'Counter staff',hash:'not-used',role:'staff',active:true});
  await ctx.db.insert('loyaltySessions',{token:'staff-test-token',staffId:id,expiresAt:Date.now()+100000});
  const row=await ctx.db.query('loyaltyLedger').first();await ctx.db.patch(row!._id,{at:Date.now()-20000});
 });
 await t.mutation(api.loyalty.issue,{token:'staff-test-token',qr,programId,count:1,key:'staff-purchase',reference:'staff-purchase'});
 expect((await t.mutation(api.loyalty.lookup,{token:'staff-test-token',qr})).programs[0].stamps).toBe(1);
 await expect(t.mutation(api.loyalty.redeem,{token:'staff-test-token',qr,rewardId:reward!._id,key:'staff-redemption',confirmed:true})).rejects.toThrow();
 await expect(t.query(api.loyalty.dashboard,{token:'staff-test-token'})).rejects.toThrow();
 await expect(t.mutation(api.loyalty.revokeCard,{token:'staff-test-token',qr,reason:'attempt'})).rejects.toThrow();
 expect((await t.query(api.loyalty.publicCard,{code:qr}))?.revoked).toBe(false);
});

test("activating another card atomically pauses the previous one", async () => {
  const { t, token, programId, rewardItemId } = await setup();
  const second = await t.mutation(api.loyalty.saveProgram, {
    token,
    name: "Second",
    rewardItemId,
    description: "",
    products: "All purchases",
    reward: "",
    threshold: 8,
    expiry: "rolling",
    months: 6,
  });
  await t.mutation(api.loyalty.setStatus, {
    token,
    id: second,
    status: "active",
  });
  const data = await t.query(api.loyalty.dashboard, { token });
  expect(
    data.programs.filter((p) => p.status === "active").map((p) => p._id),
  ).toEqual([second]);
  expect(data.programs.find((p) => p._id === programId)?.status).toBe("paused");
});

test("shared scanner password replaces individual access and invalidates all scanner sessions", async () => {
  const { t, token } = await setup();
  await t.action(api.loyalty.addStaff, {
    token,
    name: "old-worker",
    password: "old-worker-secret",
    role: "staff",
  });
  const oldSession = await t.action(api.loyalty.login, {
    password: "old-worker-secret",
  });
  await t.action(api.loyalty.setSharedStaffPassword, {
    token,
    password: "scanner-test-pass",
  });
  await expect(
    t.action(api.loyalty.login, {
      username: "staff",
      password: "old-worker-secret",
    }),
  ).rejects.toThrow();
  await expect(
    t.query(api.loyalty.dashboard, { token: oldSession }),
  ).rejects.toThrow();
  const session = await t.action(api.loyalty.login, {
    username: "staff",
    password: "scanner-test-pass",
  });
  await expect(
    t.query(api.loyalty.dashboard, { token: session }),
  ).rejects.toThrow();
  await t.action(api.loyalty.setSharedStaffPassword, {
    token,
    password: "next-scanner-pass",
  });
  await expect(
    t.mutation(api.loyalty.lookup, { token: session, qr: "a".repeat(64) }),
  ).rejects.toThrow();
  await expect(
    t.action(api.loyalty.login, {
      username: "other",
      password: "next-scanner-pass",
    }),
  ).rejects.toThrow();
  const data = await t.query(api.loyalty.dashboard, { token });
  expect(data.staff.filter((s) => s.active).map((s) => s.name)).toEqual([
    "staff",
  ]);
});

test("simple cards save one end date and configurable welcome stamps", async () => {
  const { t, token, programId, rewardItemId } = await setup();
  const endsAt=Date.now()+86400000*30;
  await t.mutation(api.loyalty.saveProgram,{token,id:programId,name:"Coffee",description:"",products:"Coffee",reward:"",rewardItemId,threshold:8,welcomeStamps:3,expiry:"campaign",months:6,endsAt});
  process.env.LOYALTY_ADMISSION_SECRET="prefill-test";
  const result=await t.mutation(api.loyalty.enroll, enrollArgs({admission:"prefill-test",bucket:"prefill",secret:"3".repeat(64),qr:"4".repeat(64)}));
  if (!result.ok) throw new Error("Enrollment unexpectedly refused");
 const card=await t.query(api.loyalty.publicCard,{code:result.code});
  expect(card?.programs[0]).toMatchObject({stamps:3,threshold:8,expiresAt:endsAt});
  expect(card).toHaveProperty("welcomeStamps",3);
  await expect(t.mutation(api.loyalty.saveProgram,{token,id:programId,name:"Coffee",description:"",products:"Coffee",reward:"",rewardItemId,threshold:4,welcomeStamps:4,expiry:"campaign",months:6,endsAt})).rejects.toThrow();
  delete process.env.LOYALTY_ADMISSION_SECRET;
});

test("statistics exclude all welcome gifts and count rewards at completion by item",async()=>{
 const {t,token,programId,rewardItemId}=await setup();
 const endsAt=Date.now()+86400000*30;
 await t.mutation(api.loyalty.saveProgram,{token,id:programId,name:"Coffee",description:"",products:"Coffee",reward:"",rewardItemId,threshold:4,welcomeStamps:2,expiry:"campaign",months:6,endsAt});
 process.env.LOYALTY_ADMISSION_SECRET="stats-test";
 await t.mutation(api.loyalty.enroll, enrollArgs({admission:"stats-test",bucket:"stats",secret:"5".repeat(64),qr:"6".repeat(64)}));
 await t.run(async ctx=>{for(const row of await ctx.db.query("loyaltyLedger").collect())if(row.actor==="system")await ctx.db.patch(row._id,{at:Date.now()-20000})});
 await t.mutation(api.loyalty.issue,{token,programId,qr:"6".repeat(64),count:2,key:"paid-stats",reference:"paid-stats"});
 const stats=await t.query(api.loyalty.statistics,{token,programId,from:Date.now()-86400000,to:Date.now()+86400000});
 expect(stats.cards).toBe(1);expect(stats.stamps).toBe(2);expect(stats.gifts).toBe(1);
 expect(stats.breakdown[0]).toMatchObject({programId,count:1,item:"ყავა"});
 expect(stats.programs[0]).toMatchObject({cards:1,stamps:2,gifts:1});
 delete process.env.LOYALTY_ADMISSION_SECRET;
});

test("all three policy translations are required",async()=>{
 const {t,token}=await setup();
 for(const lang of ["ka","en","ru"]){const terms={ka:"ქართული",en:"English",ru:"Русский",[lang]:"   "};await expect(t.mutation(api.loyalty.saveTerms,{token,terms})).rejects.toThrow();}
});

test("no active card disables enrollment preview and enrollment",async()=>{
 const {t,token,programId}=await setup();
 await t.mutation(api.loyalty.setStatus,{token,id:programId,status:"paused"});
 expect(await t.query(api.loyalty.enrollmentPreview,{})).toBeNull();
 process.env.LOYALTY_ADMISSION_SECRET="no-card-test";
 await expect(t.mutation(api.loyalty.enroll, enrollArgs({admission:"no-card-test",bucket:"none",secret:"7".repeat(64),qr:"8".repeat(64)}))).rejects.toThrow("No active");
 expect(await t.run(ctx=>ctx.db.query("loyaltyMembers").collect())).toHaveLength(1);
 delete process.env.LOYALTY_ADMISSION_SECRET;
});



test("admin sets customer points without counting purchases and completion is idempotent",async()=>{
 const {t,token,qr,programId}=await setup();
 await expect(t.mutation(api.loyalty.setPoints,{token:"invalid",qr,programId,points:3,key:"bad"})).rejects.toThrow();
 await t.mutation(api.loyalty.setPoints,{token,qr,programId,points:3,key:"adjust-three"});
 expect((await t.mutation(api.loyalty.lookup,{token,qr})).programs[0].stamps).toBe(3);
 await t.mutation(api.loyalty.setPoints,{token,qr,programId,points:1,key:"adjust-one"});
 expect((await t.mutation(api.loyalty.lookup,{token,qr})).programs[0].stamps).toBe(1);
 const completion={token,qr,programId,points:10,key:"adjust-complete"};
 await t.mutation(api.loyalty.setPoints,completion);await t.mutation(api.loyalty.setPoints,completion);
 const card=await t.mutation(api.loyalty.lookup,{token,qr});expect(card.programs[0].stamps).toBe(0);expect(card.rewards).toHaveLength(1);
 const report=await t.query(api.loyalty.statistics,{token,from:Date.now()-86400000,to:Date.now()+86400000});expect(report.stamps).toBe(0);expect(report.gifts).toBe(1);
 await expect(t.mutation(api.loyalty.setPoints,{token,qr,programId,points:11,key:"too-high"})).rejects.toThrow();
});

test("only admin can read encrypted staff credentials; primary admin password stays separate", async()=>{
 const {t,token}=await setup();const previous=process.env.LOYALTY_ADMISSION_SECRET;process.env.LOYALTY_ADMISSION_SECRET="credential-display-test-secret";
 try {
  await t.action(api.loyalty.setSharedStaffPassword,{token,password:"display-test-password"});
  await t.action(api.loyalty.setSignupPin,{token,pin:"271828"});
  expect(await t.action(api.loyalty.currentCredentials,{token})).toEqual({staffPassword:"display-test-password",pin:"271828"});
  const stored=await t.run(async ctx=>({staff:await ctx.db.query("loyaltyStaff").first(),pin:await ctx.db.query("loyaltySignupSettings").first()}));
  expect(stored.staff?.displaySecret).toMatch(/^v1\./);expect(stored.staff?.displaySecret).not.toContain("display-test-password");expect(stored.pin?.displaySecret).not.toContain("271828");
  const staffToken=await t.action(api.loyalty.login,{username:"staff",password:"display-test-password"});
  await expect(t.action(api.loyalty.currentCredentials,{token:staffToken})).rejects.toThrow();
  await expect(t.action(api.loyalty.currentCredentials,{token:"invalid"})).rejects.toThrow();
  const dashboard=await t.query(api.loyalty.dashboard,{token});expect(dashboard.staff[0]).not.toHaveProperty("displaySecret");expect(dashboard.staff[0]).not.toHaveProperty("hash");
  await t.action(api.loyalty.setSharedStaffPassword,{token,password:"replacement-test-password"});
  expect((await t.action(api.loyalty.currentCredentials,{token})).staffPassword).toBe("replacement-test-password");
  process.env.LOYALTY_ADMISSION_SECRET="different-key";expect(await t.action(api.loyalty.currentCredentials,{token})).toEqual({staffPassword:null,pin:null});
 } finally {if(previous===undefined)delete process.env.LOYALTY_ADMISSION_SECRET;else process.env.LOYALTY_ADMISSION_SECRET=previous;}
});

test("shared staff history links final scans to the exact reward and duplicate scans do not create another gift",async()=>{
 const {t,qr,programId}=await setup();
 await t.run(async ctx=>{const id=await ctx.db.insert("loyaltyStaff",{name:"staff",hash:"unused",role:"staff",active:true});for(const token of ["shared-scan-a","shared-scan-b"])await ctx.db.insert("loyaltySessions",{staffId:id,token,expiresAt:Date.now()+3600000})});
 const token="shared-scan-a";
 const first=await t.mutation(api.loyalty.issue,{token,qr,programId,count:9,key:"staff-nine",reference:"receipt-nine"});expect(first.rewards).toHaveLength(0);expect(first.stamps).toBe(9);
 await t.run(async ctx=>{const entry=await ctx.db.query("loyaltyLedger").withIndex("by_key",q=>q.eq("key","staff-nine")).unique();await ctx.db.patch(entry!._id,{at:Date.now()-20000})});
 const args={token,qr,programId,count:1,key:"staff-final",reference:"receipt-final"};
 const final=await t.mutation(api.loyalty.issue,args);expect(final.stamps).toBe(0);expect(final.rewards).toHaveLength(1);expect(final.rewards[0].label).toBe("ყავა");
 const repeat=await t.mutation(api.loyalty.issue,args);expect(repeat.rewards).toEqual(final.rewards);
 const history=await t.query(api.loyalty.staffActivity,{token:"shared-scan-b",kind:"history"});expect(history).toHaveLength(2);expect(history[0]).toMatchObject({code:qr,points:1});expect(history[0].rewards[0].id).toBe(final.rewards[0].id);expect(history[0]).not.toHaveProperty("secret");expect(history[0]).not.toHaveProperty("key");
 const gifts=await t.query(api.loyalty.staffActivity,{token,kind:"rewards"});expect(gifts).toHaveLength(1);expect(gifts[0].at).toBe(final.rewards[0].at);
 await expect(t.query(api.loyalty.staffActivity,{token:"invalid",kind:"history"})).rejects.toThrow();
});


test("historical staff rewards are linked without changing balances or issuing gifts",async()=>{
 const {t,qr,programId}=await setup();
 await t.run(async ctx=>{const id=await ctx.db.insert("loyaltyStaff",{name:"staff",hash:"unused",role:"staff",active:true});await ctx.db.insert("loyaltySessions",{staffId:id,token:"legacy-staff",expiresAt:Date.now()+3600000})});
 const token="legacy-staff";
 const result=await t.mutation(api.loyalty.issue,{token,qr,programId,count:10,key:"legacy-gift",reference:"legacy-receipt"});
 await t.run(async ctx=>{const entry=await ctx.db.query("loyaltyLedger").withIndex("by_key",q=>q.eq("key","legacy-gift")).unique();await ctx.db.patch(entry!._id,{rewardIds:undefined,earnedReward:undefined})});
 expect(await t.query(api.loyalty.staffActivity,{token,kind:"rewards"})).toHaveLength(0);
 expect(await t.mutation(internal.loyalty.backfillStaffRewardLinks,{})).toBe(1);
 expect(await t.mutation(internal.loyalty.backfillStaffRewardLinks,{})).toBe(0);
 const feed=await t.query(api.loyalty.staffActivity,{token,kind:"rewards"});expect(feed).toHaveLength(1);expect(feed[0].rewards[0].id).toBe(result.rewards[0].id);
 expect((await t.mutation(api.loyalty.lookup,{token,qr})).rewards).toHaveLength(1);
});

test("staff session status rejects expired or revoked scanner access",async()=>{
 const {t}=await setup();
 const id=await t.run(async ctx=>{const person=await ctx.db.insert("loyaltyStaff",{name:"staff",hash:"unused",role:"staff",active:true});await ctx.db.insert("loyaltySessions",{staffId:person,token:"scanner-status",expiresAt:Date.now()+3600000});return person});
 expect(await t.query(api.loyalty.scannerSession,{token:"scanner-status"})).toHaveProperty("expiresAt");
 expect(await t.query(api.loyalty.scannerSession,{token:"invalid"})).toBeNull();
 await t.run(ctx=>ctx.db.patch(id,{active:false}));expect(await t.query(api.loyalty.scannerSession,{token:"scanner-status"})).toBeNull();
 await t.run(async ctx=>{await ctx.db.patch(id,{active:true});const session=await ctx.db.query("loyaltySessions").withIndex("by_token",q=>q.eq("token","scanner-status")).unique();await ctx.db.patch(session!._id,{expiresAt:Date.now()-1})});expect(await t.query(api.loyalty.scannerSession,{token:"scanner-status"})).toBeNull();
});
