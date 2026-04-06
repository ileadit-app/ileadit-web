export default function Invite({ params }: { params: { code: string } }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-4xl font-bold text-primary">
        Competition Invite
      </h1>
      <p className="mt-4 text-lg text-text-primary">
        You&apos;ve been invited to join a competition.
      </p>
    </div>
  );
}
