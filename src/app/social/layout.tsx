import SubNav from "@/components/SubNav";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: "My People", href: "/social/people" },
          { label: "My Groups", href: "/social/groups" },
        ]}
        defaultHref="/social/people"
      />
      {children}
    </>
  );
}
