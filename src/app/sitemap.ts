import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/generate`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/templates`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/script-to-movie`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/producer`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/profile`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/balance`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    {
      url: `${base}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
