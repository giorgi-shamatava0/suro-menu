import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
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
test("enrollment requires server admission, reuses membership and limits signup bursts", async () => {
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
    t.mutation(api.loyalty.enroll, { ...a, admission: "bad" }),
  ).rejects.toThrow();
  await t.mutation(api.loyalty.enroll, a);
  await t.mutation(api.loyalty.enroll, a);
  expect(
    await t.run((ctx) => ctx.db.query("loyaltyMembers").collect()),
  ).toHaveLength(1);
  for (let i = 1; i < 5; i++)
    await t.mutation(api.loyalty.enroll, {
      ...a,
      secret: i.toString(16).repeat(64),
      qr: (i + 5).toString(16).repeat(64),
    });
  await expect(
    t.mutation(api.loyalty.enroll, { ...a, secret: "f".repeat(64) }),
  ).rejects.toThrow();
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
test("reward photo configuration never adds images to the public card or changes balances", async () => {
  const { t, token, qr, programId, rewardItemId, award } = await setup();
  await award("photo-stamps", 2);
  const image = await t.run((ctx) =>
    ctx.storage.store(
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    ),
  );
  await t.run(ctx=>ctx.db.patch(rewardItemId,{photo:image}));
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
  expect(card?.programs[0].rewardImageUrl).toBeNull();
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
test("hosted anonymous enrollment shares the global cap and never authorizes stamps",async()=>{
 const {t,programId}=await setup();process.env.LOYALTY_ADMISSION_SECRET="test-hosted-enrollment";
 const args={admission:"test-hosted-enrollment",bucket:"test-ip",qr:"c".repeat(64),secret:"d".repeat(64)};
 await t.mutation(api.loyalty.enroll,args);
 await t.mutation(api.loyalty.enroll,args);
 expect((await t.query(api.loyalty.card,{secret:args.secret}))?.programs).toHaveLength(1);
 await expect(t.mutation(api.loyalty.issue,{token:args.secret,qr:args.qr,programId,count:1,key:"forged",reference:"forged"})).rejects.toThrow();
 await t.run(async ctx=>{const limit=await ctx.db.query("loyaltyLimits").withIndex("by_key",q=>q.eq("key","signup:global")).unique();await ctx.db.patch(limit!._id,{count:200});});
 await expect(t.mutation(api.loyalty.enroll,{...args,qr:"e".repeat(64),secret:"f".repeat(64)})).rejects.toThrow();
 delete process.env.LOYALTY_ADMISSION_SECRET;
});

test('welcome awards exactly two real stamps once, including concurrent enrollment', async()=>{
 const {t}=await setup(); process.env.LOYALTY_ADMISSION_SECRET='welcome-test';
 const args={admission:'welcome-test',bucket:'welcome-ip',secret:'1'.repeat(64),qr:'2'.repeat(64)};
 const results=await Promise.all([t.mutation(api.loyalty.enroll,args),t.mutation(api.loyalty.enroll,args)]);
 expect(results[0].code).toBe(results[1].code);
 expect((await t.query(api.loyalty.publicCard,{code:results[0].code}))?.programs[0].stamps).toBe(2);
 const ledger=await t.run(ctx=>ctx.db.query('loyaltyLedger').collect());
 expect(ledger.filter(r=>r.key.startsWith('welcome:'))).toHaveLength(2);
 const member=await t.run(ctx=>ctx.db.query('loyaltyMembers').withIndex('by_secret',q=>q.eq('secret',args.secret)).unique());
 expect(member?.consentVersion).toBe('2026-11-23');
 delete process.env.LOYALTY_ADMISSION_SECRET;
});
test('rotating signup identifiers cannot bypass the server IP bucket', async()=>{
 const {t}=await setup();process.env.LOYALTY_ADMISSION_SECRET='limit-test';
 for(let i=1;i<=5;i++)await t.mutation(api.loyalty.enroll,{admission:'limit-test',bucket:'same-ip',secret:String(i).repeat(64),qr:String(i).repeat(64)});
 await expect(t.mutation(api.loyalty.enroll,{admission:'limit-test',bucket:'same-ip',secret:'6'.repeat(64),qr:'6'.repeat(64)})).rejects.toThrow();
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
