import axios from 'axios';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const { data } = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.PAYPAL_CLIENT_ID!,
        password: process.env.PAYPAL_CLIENT_SECRET!,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000; // 1min buffer
  return accessToken!;
}

const paypal = axios.create({ baseURL: PAYPAL_API });

paypal.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { paypal, PAYPAL_API };
export default paypal;
