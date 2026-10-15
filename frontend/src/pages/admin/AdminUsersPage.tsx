import { useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, UserCog, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { DataTable, StackedCell, type Column } from '@/components/ui/DataTable';
import { NoMatchesState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SearchInput, Select } from '@/components/forms/Inputs';
import { useAccountStore } from '@/stores/accountStore';
import { useCurrentAccount } from '@/stores/authStore';
import { ROLE_LABEL } from '@/lib/permissions';
import type { Account, AccountRole } from '@/types/account';
import { users } from '@/data/users';
import { formatDate } from '@/utils/date';
import { toast } from '@/stores/toastStore';

/**
 * Account management.
 *
 * Two rules are enforced in the handlers rather than left to the person using
 * the page, because both are the kind of mistake that locks an organisation
 * out of its own system:
 *
 *   An administrator cannot change their own role, and cannot suspend
 *   themselves. Either one can remove the last administrator in a single
 *   click with no way back through the interface.
 *
 * Passwords are never shown, never returned by any selector, and there is no
 * control here that could reveal one. Resetting a password is a separate flow
 * that belongs on the server.
 */
export function AdminUsersPage() {
  const actor = useCurrentAccount();
  const accounts = useAccountStore((state) => state.accounts);
  const setRole = useAccountStore((state) => state.setRole);
  const setStatus = useAccountStore((state) => state.setStatus);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AccountRole | 'all'>('all');
  const [pendingSuspend, setPendingSuspend] = useState<Account | null>(null);

  const adminCount = accounts.filter(
    (account) => account.role === 'admin' && account.status === 'active',
  ).length;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts
      .filter((account) => (roleFilter === 'all' ? true : account.role === roleFilter))
      .filter((account) =>
        needle
          ? account.name.toLowerCase().includes(needle) ||
            account.email.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, query, roleFilter]);

  const changeRole = (account: Account, role: AccountRole) => {
    if (!actor) return;
    if (account.id === actor.id) {
      toast.error('You cannot change your own role.', 'Ask another administrator to do it.');
      return;
    }
    if (account.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      toast.error('This is the last active administrator.', 'Promote someone else first.');
      return;
    }
    setRole(account.id, role, actor);
    toast.success(`${account.name} is now a ${ROLE_LABEL[role].toLowerCase()}.`);
  };

  const confirmSuspend = () => {
    if (!actor || !pendingSuspend) return;
    const next = pendingSuspend.status === 'active' ? 'suspended' : 'active';
    setStatus(pendingSuspend.id, next, actor);
    toast.success(next === 'suspended' ? 'Account suspended.' : 'Account reactivated.');
    setPendingSuspend(null);
  };

  const columns: Column<Account>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (account) => <StackedCell primary={account.name} secondary={account.email} />,
    },
    {
      id: 'role',
      header: 'Role',
      cell: (account) => (
        <Select
          aria-label={`Role for ${account.name}`}
          value={account.role}
          onChange={(event) => changeRole(account, event.target.value as AccountRole)}
          disabled={account.id === actor?.id}
          className="max-w-44"
        >
          <option value="patient">{ROLE_LABEL.patient}</option>
          <option value="professional">{ROLE_LABEL.professional}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </Select>
      ),
    },
    {
      id: 'staff',
      header: 'Staff record',
      hideBelow: 'lg',
      cell: (account) => {
        if (account.role === 'patient') {
          return <span className="text-obsidian-400">Not applicable</span>;
        }
        const staff = users.find((user) => user.id === account.staffUserId);
        return staff ? (
          <StackedCell
            primary={staff.name}
            secondary={staff.canReview ? 'Can sign off reviews' : 'Cannot sign off reviews'}
          />
        ) : (
          <Badge tone="attention" size="sm" icon={<ShieldAlert />}>
            Not linked
          </Badge>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: (account) =>
        account.status === 'active' ? (
          <Badge tone="complete" size="sm" icon={<ShieldCheck />}>
            Active
          </Badge>
        ) : (
          <Badge tone="urgent" size="sm" icon={<ShieldAlert />}>
            Suspended
          </Badge>
        ),
    },
    {
      id: 'created',
      header: 'Joined',
      hideBelow: 'md',
      cell: (account) => (
        <StackedCell
          primary={formatDate(account.createdAt)}
          secondary={
            account.lastSignInAt ? `Last in ${formatDate(account.lastSignInAt)}` : 'Never signed in'
          }
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Actions',
      align: 'right',
      cell: (account) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={account.id === actor?.id}
          onClick={() => setPendingSuspend(account)}
        >
          {account.status === 'active' ? 'Suspend' : 'Reactivate'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounts"
        description="Everyone with a sign-in, their role and whether they can still use it."
      />

      <Notice tone="info" compact>
        Anyone who registers through the public form becomes a patient. Promoting someone to health
        professional is a deliberate act here, and every change is written to the audit log.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} of ${accounts.length} accounts`}
          icon={<Users />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Search accounts"
                value={query}
                onChange={setQuery}
                placeholder="Name or email"
              />
              <Select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as AccountRole | 'all')}
                className="max-w-48"
              >
                <option value="all">All roles</option>
                <option value="patient">{ROLE_LABEL.patient}</option>
                <option value="professional">{ROLE_LABEL.professional}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </Select>
            </div>
          }
        />
        <CardBody padded={false}>
          {rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState
                entity="accounts"
                onClear={() => {
                  setQuery('');
                  setRoleFilter('all');
                }}
              />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(account) => account.id}
              caption="Registered accounts with their role and status"
              renderMobileCard={(account) => (
                <div className="space-y-2">
                  <StackedCell primary={account.name} secondary={account.email} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" size="sm" icon={<UserCog />}>
                      {ROLE_LABEL[account.role]}
                    </Badge>
                    {account.status === 'suspended' ? (
                      <Badge tone="urgent" size="sm" icon={<ShieldAlert />}>
                        Suspended
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )}
            />
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingSuspend)}
        onClose={() => setPendingSuspend(null)}
        onConfirm={confirmSuspend}
        title={
          pendingSuspend?.status === 'active' ? 'Suspend this account?' : 'Reactivate this account?'
        }
        confirmLabel={pendingSuspend?.status === 'active' ? 'Suspend' : 'Reactivate'}
        tone={pendingSuspend?.status === 'active' ? 'danger' : 'default'}
      >
        {pendingSuspend?.status === 'active' ? (
          <>
            <strong>{pendingSuspend?.name}</strong> will not be able to sign in. Their records are
            kept and nothing is deleted.
          </>
        ) : (
          <>
            <strong>{pendingSuspend?.name}</strong> will be able to sign in again.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
