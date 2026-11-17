"use client";

import {
  Avatar,
  Badge,
  Button,
  buttonVariants,
  Card,
  cn,
  ConfirmDialog,
  Icon,
  IconButton,
  Kbd,
  Menu,
  Segmented,
  Skeleton,
  Switch,
  TextField,
  toast,
} from "@linkyo/ui";
import {
  Bold,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Link2,
  Monitor,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Smartphone,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import milaAvatar from "@/assets/samples/mila-avatar.jpg";

import { Section, Specimen, SubSection } from "./section";

const VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const;
const SIZES = ["sm", "md", "lg", "xl"] as const;

export function ButtonSection() {
  const t = useTranslations("design.buttons");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Section id="buttons" index="07" title={t("title")} description={t("description")}>
      <SubSection title={t("matrix")} note={t("matrixNote")}>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface" role="region" aria-label={t("matrix")} tabIndex={0}>
          <table className="w-full text-small">
            <caption className="sr-only">{t("matrix")}</caption>
            <thead>
              <tr className="text-fg-tertiary">
                <th scope="col" className="px-5 py-3 text-start font-mono text-caption font-regular">
                  {t("variant")}
                </th>
                {SIZES.map((size) => (
                  <th key={size} scope="col" className="px-5 py-3 text-start font-mono text-caption font-regular">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((variant) => (
                <tr key={variant} className="border-t border-line">
                  <th scope="row" className="px-5 py-4 text-start font-mono text-caption font-regular text-fg-secondary">
                    {variant}
                  </th>
                  {SIZES.map((size) => (
                    <td key={size} className="px-5 py-4">
                      <Button variant={variant} size={size} icon={variant === "destructive" ? Trash2 : Plus}>
                        {variant === "destructive" ? t("delete") : t("addLink")}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SubSection>

      <SubSection title={t("states")} note={t("statesNote")}>
        <div className="grid gap-4">
          {(["primary", "secondary"] as const).map((variant) => (
            <div key={variant} className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { key: "default", extra: "" },
                { key: "hover", extra: variant === "primary" ? "bg-primary-hover" : "bg-surface-elevated border-line-input" },
                { key: "pressed", extra: variant === "primary" ? "bg-primary-pressed scale-pressed" : "bg-pressed scale-pressed" },
                { key: "focus", extra: "focus-ring" },
              ].map((state) => (
                <figure key={state.key} className="grid justify-items-start gap-2">
                  <span className={cn(buttonVariants({ variant }), state.extra, "pointer-events-none")}>{t("publish")}</span>
                  <figcaption className="font-mono text-caption text-fg-tertiary">{t(`state.${state.key}`)}</figcaption>
                </figure>
              ))}
              <figure className="grid justify-items-start gap-2">
                <Button variant={variant} disabled>
                  {t("publish")}
                </Button>
                <figcaption className="font-mono text-caption text-fg-tertiary">{t("state.disabled")}</figcaption>
              </figure>
              <figure className="grid justify-items-start gap-2">
                <Button variant={variant} loading>
                  {t("publish")}
                </Button>
                <figcaption className="font-mono text-caption text-fg-tertiary">{t("state.loading")}</figcaption>
              </figure>
            </div>
          ))}
          <Specimen label={t("loadingNote")}>
            <Button
              variant="primary"
              icon={Share2}
              loading={saving}
              onClick={() => {
                setSaving(true);
                window.setTimeout(() => {
                  setSaving(false);
                  toast({ title: t("liveToast"), tone: "success" });
                }, 1400);
              }}
            >
              {t("publish")}
            </Button>
            <Button variant="secondary" icon={Copy}>
              {t("copyLink")}
            </Button>
            <Button variant="ghost" trailing={<Kbd>N</Kbd>} icon={Plus}>
              {t("addBlock")}
            </Button>
          </Specimen>
        </div>
      </SubSection>

      <SubSection title={t("iconButtons")} note={t("iconButtonsNote")}>
        <Specimen>
          <IconButton icon={Bold} label={t("bold")} shortcut="⌘B" />
          <IconButton icon={Italic} label={t("italic")} shortcut="⌘I" />
          <IconButton icon={Link2} label={t("insertLink")} variant="secondary" />
          <IconButton icon={Plus} label={t("addBlock")} variant="primary" shortcut="N" />
          <IconButton icon={RefreshCw} label={t("refresh")} loading />
          <IconButton icon={Trash2} label={t("delete")} disabled />
        </Specimen>
      </SubSection>

      <SubSection title={t("destructive")} note={t("destructiveNote")}>
        <Specimen>
          <Button variant="destructive" icon={Trash2} onClick={() => setConfirmOpen(true)}>
            {t("deleteBlock")}
          </Button>
        </Specimen>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("confirmTitle")}
          description={t("confirmBody")}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          loading={deleting}
          onConfirm={() => {
            setDeleting(true);
            window.setTimeout(() => {
              setDeleting(false);
              setConfirmOpen(false);
              toast({ title: t("deletedToast"), action: { label: t("undo"), onAction: () => toast({ title: t("restoredToast") }) } });
            }, 900);
          }}
        />
      </SubSection>
    </Section>
  );
}

export function ControlsSection() {
  const t = useTranslations("design.controls");
  const [visible, setVisible] = useState(true);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  return (
    <Section id="controls" index="08" title={t("title")} description={t("description")}>
      <SubSection title={t("fields")}>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField label={t("displayName")} placeholder="Mila Aurel" hint={t("displayNameHint")} />
          <TextField label={t("search")} icon={Search} placeholder={t("searchPlaceholder")} trailing={<Kbd>⌘K</Kbd>} />
          <TextField
            label={t("url")}
            defaultValue="https://youtu.be/broken"
            error={t("urlError")}
            icon={Link2}
          />
          <TextField label={t("username")} defaultValue="milaaurel" disabled hint={t("usernameHint")} />
        </div>
        <TextField
          size="xl"
          label={t("universalAdd")}
          hideLabel
          icon={Plus}
          placeholder={t("universalAddPlaceholder")}
          trailing={<Kbd>N</Kbd>}
        />
      </SubSection>
      <SubSection title={t("toggles")}>
        <Specimen>
          <label className="flex items-center gap-3 text-small">
            <Switch checked={visible} onCheckedChange={setVisible} />
            <span className="inline-flex items-center gap-2">
              <Icon icon={visible ? Eye : EyeOff} size="sm" className="text-fg-secondary" />
              {visible ? t("visible") : t("hidden")}
            </span>
          </label>
          <Switch disabled label={t("disabledSwitch")} />
          <Segmented
            label={t("previewDevice")}
            value={device}
            onValueChange={setDevice}
            options={[
              { value: "mobile", label: t("mobile"), icon: Smartphone },
              { value: "desktop", label: t("desktop"), icon: Monitor },
            ]}
          />
        </Specimen>
      </SubSection>
      <SubSection title={t("badges")}>
        <Specimen>
          <Badge>{t("draft")}</Badge>
          <Badge tone="primary">{t("selected")}</Badge>
          <Badge tone="success" dot>
            {t("published")}
          </Badge>
          <Badge tone="warning">{t("scheduled")}</Badge>
          <Badge tone="danger">{t("broken")}</Badge>
          <Badge tone="spark" dot>
            {t("live")}
          </Badge>
          <Badge tone="outline">Pro</Badge>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </Specimen>
      </SubSection>
      <SubSection title={t("people")}>
        <Specimen>
          <Avatar name="Mila Aurel" size="sm" />
          <Avatar name="Mila Aurel" size="md" />
          <Avatar name="Mila Aurel" size="lg" />
          <Avatar name="Mila Aurel" size="xl" src={milaAvatar.src} />
          <Menu
            trigger={
              <IconButton icon={MoreHorizontal} label={t("moreActions")} variant="secondary" />
            }
            items={[
              { label: t("duplicate"), icon: Copy, shortcut: "⌘D", onSelect: () => toast({ title: t("duplicated") }) },
              { label: t("hide"), icon: EyeOff, onSelect: () => toast({ title: t("hiddenToast") }) },
              { label: t("delete"), icon: Trash2, destructive: true, onSelect: () => toast({ title: t("deletedToast") }) },
            ]}
          />
        </Specimen>
      </SubSection>
    </Section>
  );
}

export function StatesSection() {
  const t = useTranslations("design.states");
  return (
    <Section id="states" index="09" title={t("title")} description={t("description")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid justify-items-center gap-4 p-8 text-center">
          <span className="grid size-avatar-lg place-items-center rounded-full bg-selected text-selected-fg">
            <Icon icon={Link2} size="lg" />
          </span>
          <div className="grid gap-1">
            <p className="text-h3">{t("emptyTitle")}</p>
            <p className="text-body text-fg-secondary">{t("emptyBody")}</p>
          </div>
          <Button variant="primary" icon={Plus}>
            {t("addLink")}
          </Button>
        </Card>
        <Card className="grid gap-3 p-5" role="status" aria-busy="true" aria-label={t("loading")}>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-md border border-line p-3">
              <Skeleton className="size-avatar-md rounded-sm" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </Card>
        <Card className="flex items-start gap-4 border-danger-strong p-5" role="alert">
          <span className="grid size-avatar-md shrink-0 place-items-center rounded-full bg-danger-subtle text-danger-strong">
            <Icon icon={Link2} size="md" />
          </span>
          <div className="grid flex-1 gap-3">
            <div className="grid gap-1">
              <p className="text-body font-semibold">{t("errorTitle")}</p>
              <p className="text-small text-fg-secondary">{t("errorBody")}</p>
            </div>
            <div>
              <Button size="sm" icon={RefreshCw}>
                {t("retry")}
              </Button>
            </div>
          </div>
        </Card>
        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3 rounded-md bg-warning-subtle px-4 py-3 text-small text-warning-strong" role="status">
            <Icon icon={WifiOff} size="sm" />
            {t("offline")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toast({ title: t("successToast"), tone: "success" })}>
              {t("showSuccess")}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                toast({ title: t("deletedToast"), action: { label: t("undo"), onAction: () => toast({ title: t("restoredToast") }) } })
              }
            >
              {t("showUndo")}
            </Button>
            <Button size="sm" onClick={() => toast({ title: t("errorToast"), tone: "danger" })}>
              {t("showError")}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
