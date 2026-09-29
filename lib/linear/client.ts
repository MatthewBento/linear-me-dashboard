const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export class LinearConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearConfigError";
  }
}

export class LinearApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearApiError";
  }
}

export async function linearGraphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!apiKey.trim()) {
    throw new LinearConfigError(
      "LINEAR_API_KEY is missing. Add it to .env.local (see .env.example).",
    );
  }

  const res = await fetch(LINEAR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const text = await res.text();
  let json: GraphQLResponse<T>;
  try {
    json = JSON.parse(text) as GraphQLResponse<T>;
  } catch {
    throw new LinearApiError(
      `Linear returned a non-JSON response (${res.status}). Check that the API key is valid.`,
    );
  }

  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    if (/unauthor/i.test(msg) || res.status === 401 || res.status === 403) {
      throw new LinearApiError(
        "Linear rejected the API key (unauthorized). Check LINEAR_API_KEY in .env.local.",
      );
    }
    throw new LinearApiError(`Linear GraphQL error: ${msg}`);
  }

  if (!json.data) {
    throw new LinearApiError("Linear returned an empty payload.");
  }

  return json.data;
}
