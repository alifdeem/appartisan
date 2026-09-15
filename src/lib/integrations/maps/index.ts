import "server-only";

import { env } from "@/lib/env";
import { GoogleMapProvider } from "./google";
import { OsmMapProvider } from "./osm";
import type { MapProvider } from "./types";

let instance: MapProvider | undefined;

export function getMapProvider(): MapProvider {
  instance ??= env.MAP_PROVIDER === "google" ? new GoogleMapProvider() : new OsmMapProvider();
  return instance;
}

export * from "./types";
