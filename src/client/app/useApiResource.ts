import { useEffect, useState } from "react";
import { ApiError } from "../api/client";

export type Resource<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "not-found" }
  | { state: "unauthorized" }
  | { state: "error" };

export function useApiResource<T>(key: string, load: () => Promise<T>): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ state: "loading" });

  useEffect(() => {
    let active = true;
    setResource({ state: "loading" });
    load()
      .then((data) => {
        if (active) setResource({ state: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          setResource({ state: "not-found" });
        } else if (error instanceof ApiError && error.status === 401) {
          setResource({ state: "unauthorized" });
        } else {
          setResource({ state: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [key]);

  return resource;
}
