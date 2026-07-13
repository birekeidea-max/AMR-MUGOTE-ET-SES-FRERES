import fs from 'fs';
import path from 'path';

const baseUrl = "https://amr-mugote-et-ses-freres.vercel.app";

// Define the real, fully functional, 200 OK public routes in the SPA
const publicRoutes = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: '?page=booking', changefreq: 'weekly', priority: '0.9' },
  { path: '?page=news', changefreq: 'daily', priority: '0.8' },
  { path: '?page=gallery', changefreq: 'monthly', priority: '0.7' },
  { path: '?page=map', changefreq: 'daily', priority: '0.8' }
];

const today = new Date().toISOString().split('T')[0];

let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
`;

publicRoutes.forEach(route => {
  const url = route.path ? `${baseUrl}/${route.path}` : `${baseUrl}/`;
  xmlContent += `    <url>
        <loc>${url}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>${route.changefreq}</changefreq>
        <priority>${route.priority}</priority>
    </url>\n`;
});

xmlContent += `</urlset>`;

const outputPath = path.join(process.cwd(), 'public', 'sitemap.xml');
fs.writeFileSync(outputPath, xmlContent, 'utf-8');
console.log(`[Sitemap Generator]: sitemap.xml successfully generated with ${publicRoutes.length} real routes at ${outputPath}`);
