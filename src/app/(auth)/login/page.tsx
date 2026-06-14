import Link from "next/link";
import "../auth.css";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="cq">
      <div className="wrap">
        <span className="field-court" aria-hidden="true" />
        <div className="cardA-wrap">
          <div className="card cardA">
            <div className="cardA-head">
              <div className="cardA-top">
                <div className="brand-lockup">
                  <span className="ball" aria-hidden="true" />
                  <div className="bw">
                    <b>Padel&nbsp;Tournaments</b>
                    <small>Турнирная платформа</small>
                  </div>
                </div>
              </div>
              <div className="modeseg" role="tablist">
                <Link href="/login" role="tab" aria-selected="true" className="on">
                  Вход
                </Link>
                <Link href="/register" role="tab" aria-selected="false">
                  Регистрация
                </Link>
              </div>
            </div>

            <hr className="net-rule cardA-seam" />

            <div className="cardA-body">
              <div style={{ marginBottom: 18 }}>
                <h1>С возвращением</h1>
                <div className="sub">Войдите, чтобы регистрироваться в турнире и видеть сетку.</div>
              </div>
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
