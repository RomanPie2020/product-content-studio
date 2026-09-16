import { resetAndSeed } from "../tests/helpers/db";

export default async function globalSetup(): Promise<void> {
  await resetAndSeed();
}
