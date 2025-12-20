import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";

export default function Home() {
  return (
    <div>
      <h1>Hello World</h1>
      <Button>Click me</Button>
      <Spinner />
      <Badge>Badge</Badge>
    </div>
  );
}
