import SubNav from "@/components/SubNav";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: "Incoming", href: "/explore/incoming" },
          { label: "Discover", href: "/explore/discover" },
        ]}
        defaultHref="/explore/incoming"
      />
      {children}
    </>
  );
}
