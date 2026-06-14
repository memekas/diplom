import Link from "next/link";
import "../auth.css";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
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
                <Link href="/login" role="tab" aria-selected="false">
                  Вход
                </Link>
                <Link href="/register" role="tab" aria-selected="true" className="on">
                  Регистрация
                </Link>
              </div>
            </div>

            <hr className="net-rule cardA-seam" />

            <div className="cardA-body">
              <div style={{ marginBottom: 18 }}>
                <h1>Создать аккаунт</h1>
                <div className="sub">
                  Заполните профиль — потом сможете встать в пару и подать заявку.
                </div>
              </div>
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
