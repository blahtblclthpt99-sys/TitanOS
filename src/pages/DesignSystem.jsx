import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StatusBadge from "@/components/shared/StatusBadge";
import FilterChip from "@/components/shared/FilterChip";
import FormField from "@/components/shared/FormField";
import EmptyState from "@/components/shared/EmptyState";
import Spinner from "@/components/shared/Spinner";
import Icon from "@/components/ui/icon";
import { DS_VERSION, TYPE } from "@/lib/design-system";

function Section({ title, children }) {
  return (
    <section className="space-y-4">
      <h2 className="text-heading text-foreground border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystem() {
  const [chip, setChip] = useState("all");
  const [open, setOpen] = useState(false);

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Foundation"
        title="Design system"
        subtitle={`TitanOS DS v${DS_VERSION} — shared tokens and primitives. Use these components so every screen feels like one product.`}
      />

      <div className="space-y-10 pb-8">
        <Section title="Typography">
          <div className="titan-surface p-5 space-y-3">
            <p className={TYPE.eyebrow}>Eyebrow / section label</p>
            <p className={TYPE.display}>Display — Command Center</p>
            <p className={TYPE.title}>Title — page heading</p>
            <p className={TYPE.heading}>Heading — card / section</p>
            <p className={TYPE.body}>Body — primary reading text for forms and lists.</p>
            <p className={TYPE.caption}>Caption — metadata, helper text, timestamps.</p>
          </div>
        </Section>

        <Section title="Colors">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Primary", "bg-primary text-primary-foreground"],
              ["Secondary", "bg-secondary text-secondary-foreground"],
              ["Muted", "bg-muted text-muted-foreground"],
              ["Destructive", "bg-destructive text-destructive-foreground"],
              ["Success", "bg-success text-success-foreground"],
              ["Warning", "bg-warning text-warning-foreground"],
              ["Card", "bg-card text-card-foreground border border-border"],
              ["Background", "bg-background text-foreground border border-border"],
            ].map(([name, cls]) => (
              <div key={name} className={`rounded-lg p-4 text-xs font-semibold ${cls}`}>
                {name}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="success">Success</Button>
            <Button variant="warning">Warning</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Plus />
            </Button>
          </div>
        </Section>

        <Section title="Inputs & dropdowns">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Email" placeholder="you@example.com" hint="Used for invoices and alerts" />
            <FormField label="Role">
              <Select defaultValue="owner">
                <SelectTrigger aria-label="Role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="tech">Technician</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <Textarea placeholder="Optional notes…" rows={3} />
            </FormField>
            <FormField label="With error" error="This field is required" />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {["all", "open", "done"].map((id) => (
              <FilterChip key={id} active={chip === id} onClick={() => setChip(id)}>
                {id}
              </FilterChip>
            ))}
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Standard card</CardTitle>
                <CardDescription>Use Card for structured content blocks.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Body content sits in CardContent.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>Hover lift for navigational tiles.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Section>

        <Section title="Badges & status">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="muted">Muted</Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <StatusBadge status="scheduled" />
            <StatusBadge status="in_progress" />
            <StatusBadge status="completed" />
            <StatusBadge status="paid" />
            <StatusBadge status="overdue" />
            <StatusBadge status="lead" />
          </div>
        </Section>

        <Section title="Alerts">
          <div className="space-y-3">
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>Info</AlertTitle>
              <AlertDescription>Use for neutral guidance and beta notices.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Confirmations and completed actions.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>Risks that need attention but aren’t blocking.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Failures and validation that block progress.</AlertDescription>
            </Alert>
          </div>
        </Section>

        <Section title="Modals & tooltips">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Open modal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Example modal</DialogTitle>
                  <DialogDescription>
                    Focus trap, Escape to close, and a 40px close control.
                  </DialogDescription>
                </DialogHeader>
                <Input placeholder="Sample field" aria-label="Sample field" />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setOpen(false)}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Help">
                    <Icon icon={Sparkles} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip uses popover surface, not primary fill.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </Section>

        <Section title="Tables">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Acme Plumbing</TableCell>
                <TableCell>
                  <StatusBadge status="active" />
                </TableCell>
                <TableCell className="text-right tabular-nums">$1,240</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">River HVAC</TableCell>
                <TableCell>
                  <StatusBadge status="lead" />
                </TableCell>
                <TableCell className="text-right tabular-nums">$480</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        <Section title="Loading">
          <div className="grid sm:grid-cols-3 gap-4 items-start">
            <div className="titan-surface p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="titan-surface p-4 flex items-center justify-center min-h-[120px]">
              <Spinner size="md" label="Loading example" />
            </div>
            <div className="titan-surface p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              Inline busy state
            </div>
          </div>
        </Section>

        <Section title="Empty state">
          <div className="titan-surface">
            <EmptyState
              icon={Sparkles}
              title="Nothing here yet"
              description="EmptyState is the standard no-data pattern with an optional CTA."
              onAction={() => {}}
              actionLabel="Create first item"
            />
          </div>
        </Section>

        <Section title="Shadows & radius">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-border bg-card p-4 shadow-soft text-sm">shadow-soft · radius-md</div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-lift text-sm">shadow-lift · radius-lg</div>
            <div className="rounded-sm border border-border bg-card p-4 text-sm">radius-sm · flat</div>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
