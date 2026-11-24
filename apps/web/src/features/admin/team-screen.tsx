"use client";

import { Avatar, Button, ConfirmDialog, Icon, IconButton, Select, TextField, toast } from "@linkyo/ui";
import { Check, Mail, Minus, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type SubmitEvent } from "react";
import { z } from "zod";

import { SelectField } from "@/features/app/form";
import { Panel, Screen } from "@/features/app/screen";
import { Sheet } from "@/features/app/sheet";

import { useConsoleActions } from "./actions";
import { bdi, isolate } from "./bidi";
import { useAdmin } from "./session";
import { RoleBadge } from "./shell";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Member, type Role } from "./types";

/**
 * Who is on the team and what each role may do. Members sign in with their own Linkyo account (the
 * same email); the matrix below is the one source the whole team area checks against.
 */
export function TeamScreen() {
  const t = useTranslations("admin.team");
  const { db, can } = useAdmin();
  const [adding, setAdding] = useState(false);
  const owners = db.members.filter((member) => member.role === "owner").length;

  return (
    <Screen
      title={t("title")}
      lead={t.rich("lead", { bdi })}
      wide
      actions={
        can("team.manage") ? (
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            {t("add")}
          </Button>
        ) : null
      }
    >
      <Panel title={t("members", { count: db.members.length })} id="members-title">
        <ul className="grid grid-cols-1 divide-y divide-line">
          {db.members.map((member) => (
            <MemberRow key={member.email} member={member} lastOwner={member.role === "owner" && owners === 1} />
          ))}
        </ul>
        {can("team.manage") ? null : <p className="text-small text-fg-secondary">{t("onlyOwners")}</p>}
      </Panel>
      <PermissionsMatrix />
      <AddMemberSheet open={adding} onOpenChange={setAdding} />
    </Screen>
  );
}

function MemberRow({ member, lastOwner }: { member: Member; lastOwner: boolean }) {
  const t = useTranslations("admin.team");
  const tRoles = useTranslations("admin.roles");
  const { me, can } = useAdmin();
  const actions = useConsoleActions();
  const [removing, setRemoving] = useState(false);
  const id = useId();
  const isMe = member.email === me.email;
  const editable = can("team.manage") && !isMe && !lastOwner;

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar name={member.name} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-body font-semibold">
          {member.name}
          {isMe ? <span className="font-regular text-fg-tertiary"> · {t("you")}</span> : null}
        </span>
        <span dir="ltr" className="truncate text-start text-small text-fg-secondary">
          {member.email}
        </span>
      </span>
      {editable ? (
        <>
          <Select
            id={id}
            label={t("roleOf", { name: member.name })}
            hideLabel
            value={member.role}
            onValueChange={(next) => {
              void actions.setRole(member.email, next).then((changed) =>
                toast(
                  changed
                    ? { title: t("roleChanged", { name: member.name, role: tRoles(`${next}.name`) }), tone: "success" }
                    : { title: t("failed"), tone: "danger" },
                ),
              );
            }}
            options={ROLES.map((role) => ({ value: role, label: tRoles(`${role}.name`) }))}
            className="w-auto"
          />
          <IconButton icon={Trash2} label={t("remove", { name: member.name })} className="text-danger-strong" onClick={() => setRemoving(true)} />
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={t("removeTitle", { name: member.name })}
            description={t("removeBody")}
            confirmLabel={t("removeConfirm")}
            cancelLabel={t("cancel")}
            onConfirm={() => {
              void actions.removeMember(member.email).then((removed) => {
                if (!removed) toast({ title: t("failed"), tone: "danger" });
              });
              setRemoving(false);
            }}
          />
        </>
      ) : (
        <RoleBadge role={member.role} size="md" />
      )}
    </li>
  );
}

function PermissionsMatrix() {
  const t = useTranslations("admin.team");
  const tRoles = useTranslations("admin.roles");
  const tPermissions = useTranslations("admin.permissions");
  return (
    <Panel title={t("matrixTitle")} id="matrix-title">
      <p className="text-small text-fg-secondary">{t("matrixLead")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <div key={role} className="flex flex-col items-start gap-2 rounded-md border border-line p-3">
            <RoleBadge role={role} size="md" />
            <p className="text-small text-fg-secondary">{tRoles(`${role}.description`)}</p>
          </div>
        ))}
      </div>
      {/* Phones: one row per permission with the four roles under it, so no role is cut off at the side (A-11). */}
      <ul aria-label={t("matrixTitle")} data-permissions-list className="grid divide-y divide-line md:hidden">
        {PERMISSIONS.map((permission) => (
          <li key={permission} className="grid gap-2 py-3 first:pt-0 last:pb-0">
            <p className="text-small font-medium">{tPermissions.rich(permission.replace(".", "_"), { bdi })}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {ROLES.map((role) => {
                const allowed = ROLE_PERMISSIONS[role].includes(permission);
                return (
                  <li key={role} className={allowed ? "flex items-center gap-1 text-caption text-fg" : "flex items-center gap-1 text-caption text-fg-tertiary"}>
                    <Icon icon={allowed ? Check : Minus} size="sm" label={allowed ? t("allowed") : t("notAllowed")} className={allowed ? "text-success-strong" : "text-fg-tertiary"} />
                    {tRoles(`${role}.name`)}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-small">
          <caption className="sr-only">{t("matrixTitle")}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pe-3 text-start font-medium text-fg-secondary">
                {t("permission")}
              </th>
              {ROLES.map((role) => (
                <th key={role} scope="col" className="px-2 py-2 text-center font-semibold">
                  {tRoles(`${role}.name`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 pe-3 text-start font-regular">
                  {tPermissions.rich(permission.replace(".", "_"), { bdi })}
                </th>
                {ROLES.map((role) => {
                  const allowed = ROLE_PERMISSIONS[role].includes(permission);
                  return (
                    <td key={role} className="px-2 py-2 text-center">
                      <Icon
                        icon={allowed ? Check : Minus}
                        size="sm"
                        label={allowed ? t("allowed") : t("notAllowed")}
                        className={allowed ? "inline-block text-success-strong" : "inline-block text-fg-tertiary"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AddMemberSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.team.addSheet");
  const tRoles = useTranslations("admin.roles");
  const { db } = useAdmin();
  const actions = useConsoleActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [tried, setTried] = useState(false);
  const normalized = email.trim().toLowerCase();
  const emailError = !z.email().safeParse(normalized).success ? "invalid" : db.members.some((member) => member.email === normalized) ? "taken" : null;
  const nameError = name.trim() ? null : "missing";

  const close = () => {
    onOpenChange(false);
    setName("");
    setEmail("");
    setRole("editor");
    setTried(false);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTried(true);
    if (nameError || emailError) {
      document.getElementById(nameError ? "member-name" : "member-email")?.focus();
      return;
    }
    void actions.addMember({ name: name.trim(), email: normalized, role }).then((added) => {
      if (added === true) {
        toast({ title: t("added", { name: name.trim() }), tone: "success" });
        close();
      } else {
        toast({ title: added === "notFound" ? t.markup("noAccount", { email: normalized, bdi: isolate }) : t("failed"), tone: "danger" });
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("title")}
      description={t.markup("lead", { bdi: isolate })}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("cancel")}
          </Button>
          <Button variant="primary" type="submit" form="add-member-form">
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id="add-member-form" noValidate onSubmit={submit} className="grid grid-cols-1 gap-5">
        <TextField id="member-name" label={t("name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} error={tried && nameError ? t("nameMissing") : undefined} />
        <TextField
          id="member-email"
          label={t("email")}
          type="email"
          ltr
          icon={Mail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          inputMode="email"
          hint={t.rich("emailHint", { bdi })}
          error={tried && emailError ? t(`emailErrors.${emailError}`) : undefined}
        />
        <SelectField label={t("role")} value={role} onValue={setRole} options={ROLES.map((value) => ({ value, label: tRoles(`${value}.name`) }))} />
        <p className="rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">{tRoles(`${role}.description`)}</p>
      </form>
    </Sheet>
  );
}
