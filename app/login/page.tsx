import { redirect } from "next/navigation";
import { getFamilyPasswordConfigured, isFamilyAuthenticated } from "../auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isFamilyAuthenticated()) redirect("/");

  const params = searchParams ? await searchParams : {};
  const returnTo = singleValue(params.returnTo) ?? "/";
  const error = singleValue(params.error);
  const isConfigured = getFamilyPasswordConfigured();

  return (
    <main className="login-page">
      <section className="login-panel">
        <span className="brand-mark login-mark">古</span>
        <p className="section-kicker">古本家の歴史</p>
        <h1>家族用パスワード</h1>
        <form action="/api/auth/login" className="entry-form" method="post">
          <input name="returnTo" type="hidden" value={returnTo} />
          <label>
            <span>パスワード</span>
            <input
              autoComplete="current-password"
              disabled={!isConfigured}
              name="password"
              required
              type="password"
            />
          </label>
          {error === "1" ? <p className="form-error">パスワードが違います。</p> : null}
          {error === "setup" || !isConfigured ? (
            <p className="form-error">パスワード設定がまだ有効になっていません。</p>
          ) : null}
          <button className="primary-button" disabled={!isConfigured} type="submit">
            入る
          </button>
        </form>
      </section>
    </main>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
