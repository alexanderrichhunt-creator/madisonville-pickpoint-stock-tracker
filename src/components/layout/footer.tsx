import { MapPin, Phone } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              Madisonville Family Medicine
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              712 S. May St, Madisonville, TX 77864
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              936-348-3418
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <Separator className="mb-4 sm:hidden" />
            <p className="font-medium text-foreground/80">
              For internal use only
            </p>
            <p>HealthPoint FQHC Madisonville</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
