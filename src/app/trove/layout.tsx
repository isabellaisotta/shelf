import SubNav from "@/components/SubNav";

export default function TroveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: "Consumed", href: "/trove/consumed" },
          { label: "To Consume", href: "/trove/to-consume" },
        ]}
        defaultHref="/trove/consumed"
      />
      {children}
    </>
  );
}
