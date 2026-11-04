import { useEffect, useRef, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { getSession } from "../api/auth";

const WEBAPP_URL = import.meta.env.VITE_WEBAPP_URL ?? "http://localhost:3000/app";

// CIAM sends the user back here with ?code=, which we trade for the custParam session
const code = new URLSearchParams(window.location.search).get("code");

function CiamCallback() {
  const [failed, setFailed] = useState(!code);
  // StrictMode runs effects twice in dev, and a code can only be used once
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    getSession(code)
      .then(({ custParam }) => {
        // The insurtech webapp home page reads ?custParam=
        const target = new URL(WEBAPP_URL);
        target.searchParams.set("custParam", custParam);
        window.location.replace(target.toString());
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <MainLayout>
      <div className="flex flex-col flex-1 items-center justify-center gap-[16px] px-[22px] bg-white text-center">
        {failed ? (
          <>
            <p role="alert" className="text-ink text-[14px] font-[600]">
              Login gagal. Silakan coba lagi.
            </p>
            <button
              type="button"
              onClick={() => window.location.replace("/")}
              className="btn btn-primary h-[48px] w-full text-[16px] font-[600]"
            >
              Kembali ke Login
            </button>
          </>
        ) : (
          <p className="text-muted text-[14px]">Memproses login...</p>
        )}
      </div>
    </MainLayout>
  );
}

export default CiamCallback;
