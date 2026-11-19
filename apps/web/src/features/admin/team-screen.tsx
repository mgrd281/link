"use client";

import { Avatar, Button, ConfirmDialog, Icon, IconButton, TextField, toast } from "@linkyo/ui";
import { Check, Mail, Minus, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type SubmitEvent } from "react";
import { z } from "zod";

import { SelectField } from "@/features/app/form";
import { Panel, Screen } from "@/features/app/screen";
import { Sheet } from "@/features/app/sheet";

import { useConsoleActions } from "./actions";
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
      lead={t("lead")}
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
          <label htmlFor={id} className="sr-only">
            {t("roleOf", { name: member.name })}
          </label>
          <select
            id={id}
            value={member.role}
            onChange={(event) => {
              const next = event.target.value as Role;
              void actions.setRole(member.email, next).then((changed) =>
                toast(
                  changed
                    ? { title: t("roleChanged", { name: member.name, role: tRoles(`${next}.name`) }), tone: "success" }
                    : { title: t("failed"), tone: "danger" },
                ),
              );
            }}
            className="h-control-md rounded-md border border-line-input bg-surface-elevated px-3 text-small text-fg outline-none hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {tRoles(`${role}.name`)}
              </option>
            ))}
          </select>
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
      <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
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
                  {tPermissions(permission.replace(".", "_"))}
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
        toast({ title: added === "notFound" ? t("noAccount", { email: normalized }) : t("failed"), tone: "danger" });
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("title")}
      description={t("lead")}
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
          hint={t("emailHint")}
          error={tried && emailError ? t(`emailErrors.${emailError}`) : undefined}
        />
        <SelectField label={t("role")} value={role} onValue={setRole} options={ROLES.map((value) => ({ value, label: tRoles(`${value}.name`) }))} />
        <p className="rounded-md bg-canvas-muted px-3 py-2 text-small text-fg-secondary">{tRoles(`${role}.description`)}</p>
      </form>
    </Sheet>
  );
}
