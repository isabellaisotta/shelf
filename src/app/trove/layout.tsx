import SubNav from "@/components/SubNav";

export default function TroveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: "Trove", href: "/trove/consumed" },
          { label: "Up Next", href: "/trove/to-consume" },
        ]}
        defaultHref="/trove/consumed"
      />
      {children}
    </>
  );
}
