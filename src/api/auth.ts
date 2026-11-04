// Login API (BE Postman: INSURTECH / WEBAPI / Oauth2)
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7800";
// CIAM (e.g. https://preprod.ciam.telkomsel.com:10004/iam/v1/). Defaults to the mock's fake CIAM.
const CIAM_URL = import.meta.env.VITE_CIAM_URL ?? "http://localhost:7800/ciam/iam/v1/";
const CIAM_CLIENT_ID = import.meta.env.VITE_CIAM_CLIENT_ID ?? "klop";
// Must be the redirect_uri registered with CIAM (path matches CALLBACK_PATH in main.tsx)
const CIAM_REDIRECT_URI = import.meta.env.VITE_CIAM_REDIRECT_URI ?? `${window.location.origin}/auth`;

export type AccountType = "telkomsel" | "indihome";

// Telkomsel has no email OTP endpoint yet, so email always goes through emailLoginIndihome
export type OtpMethod = "phoneLoginMobile" | "phoneLoginIndihome" | "emailLoginIndihome";

export interface OtpTarget {
  masked: string;
  referenceID: string;
}

export interface AccountTargets {
  mobile: OtpTarget[];
  email: OtpTarget[];
}

interface OtpSubmitResult {
  tokenId: string;
  successUrl: string;
  realm: string;
}

interface Session {
  custParam: string;
  expiryDate: string;
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response;
  try {
    // The BE keeps the session in a cookie, so always send cookies
    res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  } catch {
    throw new ApiError("NETWORK", "Network error");
  }
  const json = await res.json().catch(() => null);
  if (!json || json.status?.code !== "OK00") {
    throw new ApiError(json?.status?.code ?? String(res.status), json?.status?.message ?? res.statusText);
  }
  return json.data as T;
};

const postForm = <T>(path: string, fields: Record<string, string>) => {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  return request<T>(path, { method: "POST", body });
};

// IndiHome numbers come back wrapped in tselID
export const checkNumber = async (type: AccountType, number: string): Promise<AccountTargets> => {
  const data = await postForm<Partial<AccountTargets> & { tselID?: Partial<AccountTargets> }>(
    `/v1/oauth2/check-number/${type}`,
    { number }
  );
  const targets = data.tselID ?? data;
  return { mobile: targets.mobile ?? [], email: targets.email ?? [] };
};

// Returns the encrypted string that otp-submit needs back
export const requestOtp = (method: OtpMethod, target: OtpTarget) =>
  postForm<string>(`/v1/oauth2/otp-request/${method}`, { ...target });

export const submitOtp = (method: OtpMethod, data: string, code: string) =>
  postForm<OtpSubmitResult>(`/v1/oauth2/otp-submit/${method}`, { data, code });

export const getSession = (accessCode: string) =>
  request<Session>(`/v1/oauth2/otp-session-authorization?accessCode=${encodeURIComponent(accessCode)}`);

// Full page POST, since CIAM answers with a 302 back to our callback page (?code=)
export const goToAuthorization = () => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = new URL("oauth2/realms/tsel/authorize", CIAM_URL).toString();
  const fields = {
    client_id: CIAM_CLIENT_ID,
    redirect_uri: CIAM_REDIRECT_URI,
    response_type: "code",
    nonce: "true",
    scope: "profile openid identifier",
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
};
