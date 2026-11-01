import { resolveApiBaseUrl } from "./apiUrl";

test.each(["localhost", "127.0.0.1", "192.168.1.42", "care-station.local"])(
  "development API uses the page's %s hostname so requests do not target a different computer or cookie site",
  hostname => {
    expect(resolveApiBaseUrl({ environment: "development", hostname })).toBe(`http://${hostname}:8080/api`);
  },
);

test.each(["[::1]", "::1"])("development IPv6 hostname %s keeps valid URL brackets", hostname => {
  expect(resolveApiBaseUrl({ environment: "development", hostname })).toBe("http://[::1]:8080/api");
});

test.each(["development", "production", "test"])("explicit API URL wins in %s", environment => {
  expect(resolveApiBaseUrl({ configured: "/api", environment, hostname: "127.0.0.1" })).toBe("/api");
  expect(resolveApiBaseUrl({ configured: " https://api.example.test/api ", environment, hostname: "127.0.0.1" }))
    .toBe("https://api.example.test/api");
});

test("production keeps its existing API and never derives a development endpoint from the page", () => {
  expect(resolveApiBaseUrl({ environment: "production", hostname: "127.0.0.1" }))
    .toBe("https://carevigoapi.onrender.com/api");
});

test.each([undefined, "", "example.test/path", "user@example.test"])("invalid or missing browser hostname %s uses the local default", hostname => {
  expect(resolveApiBaseUrl({ environment: "development", hostname })).toBe("http://localhost:8080/api");
});
