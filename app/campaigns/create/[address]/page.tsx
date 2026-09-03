import Link from "next/link";
import { Slash } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CampaignCreateGuard } from "@/components/vote/CampaignCreateGuard";
import { CreateShoppableCampaign } from "@/components/campaigns/CreateShoppableCampaign";

export default function CreateShoppableCampaignPage() {
  return (
    <div className="container">
      <div className="my-5 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/vote">Campaigns</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Shoppable</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="px-4 pb-10">
        <h1 className="mb-2 text-2xl font-semibold">Create shoppable campaign</h1>
        <p className="mb-6 text-sm text-muted-foreground max-w-xl">
          Upload a product kit to Lens Grove and open a Snapshot proposal. After
          approval, attach a creator video for AI product overlays.
        </p>
        <CampaignCreateGuard>
          <CreateShoppableCampaign />
        </CampaignCreateGuard>
      </div>
    </div>
  );
}
