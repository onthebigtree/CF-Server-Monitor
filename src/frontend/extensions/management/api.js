import { http } from "../../utils/http";
function options() {
  return {
    baseUrl: window.location.origin,
    managementRequest: true,
    autoRedirect: false,
  };
}
export async function managementRequest(method, path, payload) {
  if (!/^\/(?:status|users(?:\/[a-f0-9]{32})?)$/.test(path))
    throw new Error("invalid_management_path");
  const result =
    method === "get"
      ? await http.get("/api/management" + path, options())
      : await http[method]("/api/management" + path, payload, options());
  if (result.error) {
    const error = new Error(result.error);
    error.status = result.status;
    throw error;
  }
  return result.data;
}
