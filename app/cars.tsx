import { Redirect } from "expo-router";

/** Old route kept so existing links keep working; the content now lives in the shared screen. */
export default function LegacyRoute() {
  return <Redirect href={{ pathname: "/category/[slug]", params: { slug: "cars" } }} />;
}
