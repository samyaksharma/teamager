
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SocketProvider } from "@/lib/socketContext"
import { AuthProvider } from "@/lib/authContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Teamager - All-in-One Workspace",
  description: "Combine project management, team communication, and knowledge base in one seamless platform.",
  icons: {
    icon: "/teamager-dark.svg",
    apple: "/teamager-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem={true} 
          storageKey="teamager-theme"
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <SocketProvider>
              {children}
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}