import type { ReactNode } from 'react'

const MainLayout = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-page w-screen overflow-hidden md:w-[412px] flex flex-col h-[100dvh] min-h-[100dvh]"
    style={{
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}
  >
    <main className="flex-1 flex flex-col min-h-0 h-full">{children}</main>
  </div>
)

export default MainLayout
