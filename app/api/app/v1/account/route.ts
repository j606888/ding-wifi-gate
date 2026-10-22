import { deleteAccount, loginProviders, requireAppUser } from "@/lib/accounts";

// 「我的帳號」：名字、Email、用哪些方式登入
export async function GET(req: Request) {
  const user = await requireAppUser(req);
  if (user instanceof Response) return user;
  return Response.json({ user: { ...user, providers: await loginProviders(user.id) } });
}

// 刪除帳號。body：{ appleAuthorizationCode? }（用 Apple 登入的帳號，App 重新拿一次 code 帶過來撤銷授權）
export async function DELETE(req: Request) {
  const user = await requireAppUser(req);
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  const code = typeof body.appleAuthorizationCode === "string" ? body.appleAuthorizationCode : undefined;
  await deleteAccount(user.id, code);
  return Response.json({ status: "ok" });
}
