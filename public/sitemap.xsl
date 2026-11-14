<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
    xmlns:html="http://www.w3.org/TR/REC-html40"
    xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>XML Sitemap | Zentirog Discord Usernames Market</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #eaebee;
            background: #090a0d;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: #101115;
            border: 1px solid #23252c;
            padding: 32px;
          }
          .header {
            border-bottom: 1px solid #23252c;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .badge {
            display: inline-block;
            font-family: monospace;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #d4af37;
            background: #1a170f;
            border: 1px solid #3d3319;
            padding: 4px 8px;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            letter-spacing: -0.02em;
          }
          p.desc {
            color: #8c909b;
            font-size: 13px;
            margin: 0;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 16px;
          }
          th {
            text-align: left;
            padding: 12px 14px;
            background: #16171d;
            color: #d4af37;
            font-family: monospace;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            border-bottom: 1px solid #23252c;
          }
          td {
            padding: 14px;
            border-bottom: 1px solid #1a1b22;
            color: #b5b8c2;
            word-break: break-all;
          }
          tr:hover td {
            background: #14151b;
            color: #ffffff;
          }
          a {
            color: #eaebee;
            text-decoration: none;
            transition: color 0.15s ease;
          }
          a:hover {
            color: #d4af37;
            text-decoration: underline;
          }
          .mono {
            font-family: monospace;
            font-size: 12px;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #23252c;
            font-size: 12px;
            color: #636674;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">Zentirog Indexing System</div>
            <h1>XML Sitemap</h1>
            <p class="desc">
              This machine-readable XML sitemap is used by Googlebot, Bingbot, and AI crawlers to discover and index pages on <strong>zentirog.com</strong>.
            </p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>URL</th>
                <th style="width: 140px;">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:variable name="lower" select="'abcdefghijklmnopqrstuvwxyz'"/>
              <xsl:variable name="upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td class="mono" style="color: #636674;"><xsl:value-of select="position()"/></td>
                  <td>
                    <a href="{sitemap:loc}">
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td class="mono">
                    <xsl:value-of select="sitemap:lastmod"/>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
          <div class="footer">
            <span>Zentirog Discord Username Marketplace</span>
            <span>Total URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
