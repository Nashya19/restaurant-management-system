import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: {
    template: '%s | Sauté Restaurant Management',
    default: 'Sauté | Modern AI-Ready Restaurant Management System',
  },
  description: "Sauté is a premium, real-time restaurant management system (RMS) featuring an intelligent Kitchen Display System, dynamic wait times, and QR ordering.",
  keywords: [
    "Restaurant Management System", 
    "RMS", 
    "Kitchen Display System", 
    "KDS", 
    "QR Code Ordering", 
    "Restaurant Point of Sale", 
    "Restaurant AI", 
    "Food Waste Management",
    "Sauté"
  ],
  authors: [{ name: "Sauté Technologies" }],
  creator: "Sauté",
  publisher: "Sauté",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
  applicationName: "Sauté",
  appleWebApp: {
    capable: true,
    title: "Sauté",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Restaurant Management System | Sauté",
    description: "Modern restaurant management platform",
    siteName: "Sauté",
    images: [
      {
        url: "/images/logo-text-tagline-darkmode.png",
        width: 1200,
        height: 630,
        alt: "Sauté Logo and Tagline",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Restaurant Management System | Sauté",
    description: "Modern restaurant management platform",
    images: ["/images/logo-text-tagline-darkmode.png"],
  },
  category: "technology",
};

// JSON-LD Structured Data for Google AI / Search
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Sauté",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Premium real-time restaurant management system featuring AI-ready operations, intelligent KDS, and table management.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "creator": {
    "@type": "Organization",
    "name": "Sauté Technologies"
  }
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/images/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/images/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/logo.png" type="image/png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
