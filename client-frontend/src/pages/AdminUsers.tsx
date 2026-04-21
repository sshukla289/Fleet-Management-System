import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/useAuth'
import { ALL_ROLES, ROLE_LABELS } from '../security/permissions'
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateUserRole,
} from '../services/apiService'
import type {
  AdminUser,
  AppRole,
  AdminUserMutationResult,
  AdminUserStatus,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '../types'
import './AdminUsers.css'

type ModalMode = 'create' | 'edit' | 'role'
type RowAction = 'status' | 'reset' | 'delete'
type BannerTone = 'success' | 'error' | 'info'

interface UserFormState {
  name: string
  email: string
  role: AppRole
  active: boolean
}

interface BannerState {
  tone: BannerTone
  title: string
  message: string
  secret?: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const ROLE_FILTER_OPTIONS: Array<'ALL' | AppRole> = ['ALL', ...ALL_ROLES]
const STATUS_FILTER_OPTIONS: Array<'ALL' | AdminUserStatus> = ['ALL', 'ACTIVE', 'INACTIVE']

const createEmptyForm = (): UserFormState => ({
  name: '',
  email: '',
  role: 'DRIVER',
  active: true,
})

function formatRoleLabel(role: AppRole) {
  return ROLE_LABELS[role] ?? role
}

function formatStatusLabel(status: AdminUserStatus) {
  return status === 'ACTIVE' ? 'Active' : 'Inactive'
}

function isActiveStatus(status: AdminUserStatus) {
  return status === 'ACTIVE'
}

function buildFormState(user: AdminUser): UserFormState {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    active: isActiveStatus(user.status),
  }
}

function isSelfUser(user: AdminUser, currentUserId?: string) {
  return Boolean(currentUserId) && user.id === currentUserId
}

function UsersGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 21v-1a5.5 5.5 0 0 1 7 0v1" />
    </svg>
  )
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function RefreshGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M7 18H6v4" />
      <path d="M17 6h1V2" />
    </svg>
  )
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function AdminUsersPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const currentUserId = session?.profile.id

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [roleFilter, setRoleFilter] = useState<'ALL' | AppRole>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminUserStatus>('ALL')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [formState, setFormState] = useState<UserFormState>(createEmptyForm())
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [rowAction, setRowAction] = useState<{ userId: string; action: RowAction } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const closeModal = useCallback(() => {
    setModalMode(null)
    setEditingUser(null)
    setFormState(createEmptyForm())
    setModalError('')
    setIsSubmitting(false)
  }, [])

  useEffect(() => {
    setPage(0)
  }, [deferredSearch, roleFilter, statusFilter, pageSize])

  const usersQuery = useQuery({
    queryKey: ['admin-users', page, pageSize, deferredSearch, roleFilter, statusFilter],
    queryFn: () =>
      fetchAdminUsers({
        page,
        size: pageSize,
        search: deferredSearch,
        role: roleFilter,
        status: statusFilter,
      }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    const totalPages = usersQuery.data?.totalPages ?? 0
    if (totalPages === 0 && page !== 0) {
      setPage(0)
      return
    }

    if (totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1)
    }
  }, [page, usersQuery.data?.totalPages])

  useEffect(() => {
    if (!modalMode) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [modalMode, closeModal])

  const users = useMemo(
    () => usersQuery.data?.content ?? [],
    [usersQuery.data?.content],
  )
  const totalUsers = usersQuery.data?.totalElements ?? 0
  const totalPages = usersQuery.data?.totalPages ?? 0
  const currentPage = usersQuery.data?.page ?? page
  const currentPageSize = usersQuery.data?.size ?? pageSize
  const pageStart = totalUsers > 0 && users.length > 0 ? currentPage * currentPageSize + 1 : 0
  const pageEnd = totalUsers > 0 && users.length > 0 ? pageStart + users.length - 1 : 0
  const pageLabel = totalUsers > 0 ? `Page ${currentPage + 1} of ${Math.max(1, totalPages)}` : 'No results'
  const isInitialLoading = usersQuery.isPending && !usersQuery.data
  const isRefreshing = usersQuery.isFetching && Boolean(usersQuery.data)
  const isBusy = isSubmitting || rowAction !== null

  const activeCount = useMemo(
    () => users.filter((user) => user.status === 'ACTIVE').length,
    [users],
  )
  const inactiveCount = useMemo(
    () => users.filter((user) => user.status === 'INACTIVE').length,
    [users],
  )
  const adminCount = useMemo(
    () => users.filter((user) => user.role === 'ADMIN').length,
    [users],
  )

  function openCreateModal() {
    setEditingUser(null)
    setFormState(createEmptyForm())
    setModalMode('create')
    setModalError('')
  }

  function openEditModal(user: AdminUser, mode: ModalMode = 'edit') {
    setEditingUser(user)
    setFormState(buildFormState(user))
    setModalMode(mode)
    setModalError('')
  }

  function showBanner(nextBanner: BannerState) {
    setBanner(nextBanner)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setModalError('')

    const payloadName = formState.name.trim()
    const payloadEmail = formState.email.trim()
    const payloadRole = formState.role

    if (!payloadName || !payloadEmail) {
      setModalError('Name and email are required.')
      return
    }

    setIsSubmitting(true)

    try {
      if (modalMode === 'create') {
        const payload: CreateAdminUserInput = {
          name: payloadName,
          email: payloadEmail,
          role: payloadRole,
        }
        const result = await createAdminUser(payload)
        showBanner({
          tone: 'success',
          title: `User created: ${result.user.name}`,
          message: 'Share the temporary password with the new user so they can sign in.',
          secret: result.temporaryPassword,
        })
        closeModal()
        setPage(0)
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        return
      }

      if (!editingUser) {
        setModalError('Select a user to edit.')
        return
      }

      const original = buildFormState(editingUser)
      const shouldUseRoleEndpoint =
        modalMode === 'role' &&
        payloadName === original.name &&
        payloadEmail === original.email &&
        formState.active === original.active &&
        payloadRole !== original.role

      if (shouldUseRoleEndpoint) {
        const updated = await updateUserRole(editingUser.id, { role: payloadRole })
        showBanner({
          tone: 'success',
          title: `Role updated: ${updated.name}`,
          message: `${updated.name} is now ${formatRoleLabel(updated.role)}.`,
        })
      } else {
        const payload: UpdateAdminUserInput = {
          name: payloadName,
          email: payloadEmail,
          role: payloadRole,
          active: formState.active,
        }
        const updated = await updateAdminUser(editingUser.id, payload)
        showBanner({
          tone: 'success',
          title: `User updated: ${updated.name}`,
          message: `${updated.name}'s account has been refreshed.`,
        })
      }

      closeModal()
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Unable to save user.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(user: AdminUser) {
    const nextStatus = user.status === 'ACTIVE' ? 'deactivate' : 'activate'
    const confirmed = window.confirm(`${nextStatus.charAt(0).toUpperCase()}${nextStatus.slice(1)} ${user.name}?`)
    if (!confirmed) {
      return
    }

    setRowAction({ userId: user.id, action: 'status' })

    try {
      const updated = await updateAdminUser(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.status !== 'ACTIVE',
      })

      showBanner({
        tone: 'success',
        title: `${updated.name} ${updated.status === 'ACTIVE' ? 'activated' : 'deactivated'}`,
        message: `Account status is now ${formatStatusLabel(updated.status)}.`,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      showBanner({
        tone: 'error',
        title: 'Status update failed',
        message: error instanceof Error ? error.message : 'Unable to change user status.',
      })
    } finally {
      setRowAction(null)
    }
  }

  async function handleResetPassword(user: AdminUser) {
    const confirmed = window.confirm(`Reset the password for ${user.name}?`)
    if (!confirmed) {
      return
    }

    setRowAction({ userId: user.id, action: 'reset' })

    try {
      const result: AdminUserMutationResult = await resetAdminUserPassword(user.id)
      showBanner({
        tone: 'info',
        title: `Password reset for ${result.user.name}`,
        message: 'Copy the temporary password and share it through a secure channel.',
        secret: result.temporaryPassword,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      showBanner({
        tone: 'error',
        title: 'Password reset failed',
        message: error instanceof Error ? error.message : 'Unable to reset password.',
      })
    } finally {
      setRowAction(null)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (isSelfUser(user, currentUserId)) {
      showBanner({
        tone: 'error',
        title: 'Self-delete blocked',
        message: 'You cannot delete your own account.',
      })
      return
    }

    const confirmed = window.confirm(`Delete ${user.name}? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    setRowAction({ userId: user.id, action: 'delete' })

    try {
      await deleteAdminUser(user.id)
      showBanner({
        tone: 'success',
        title: `${user.name} deleted`,
        message: 'The user account has been removed from the system.',
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      showBanner({
        tone: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unable to delete user.',
      })
    } finally {
      setRowAction(null)
    }
  }

  function handleDismissBanner() {
    setBanner(null)
  }

  function handleCopySecret() {
    if (!banner?.secret || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    void navigator.clipboard.writeText(banner.secret)
  }

  const emptyState =
    !isInitialLoading && users.length === 0 ? (
      <div className="admin-users-empty">
        <strong>{totalUsers === 0 ? 'No users match the current filters.' : 'This page has no users.'}</strong>
        <p>
          {totalUsers === 0
            ? 'Try clearing the search term or switching the role/status filters.'
            : 'Move to the previous page or refine the filters to continue browsing.'}
        </p>
      </div>
    ) : null

  return (
    <div className="page-shell admin-users-page">
      <section className="admin-users-hero">
        <div className="admin-users-hero__copy">
          <span className="admin-users-hero__eyebrow">User and role management</span>
          <h2 className="admin-users-hero__title">Control account access from a single admin workspace.</h2>
          <p className="admin-users-hero__lede">
            Search, filter, paginate, create, edit, change roles, toggle account status, and reset passwords without pulling the full directory into memory.
          </p>
          <div className="admin-users-hero__chips">
            <span className="admin-users-chip"><UsersGlyph /> {totalUsers} matched users</span>
            <span className="admin-users-chip"><ShieldGlyph /> Admin-only role changes</span>
            <span className="admin-users-chip"><RefreshGlyph /> Server-side pagination</span>
          </div>
        </div>

        <div className="admin-users-hero__panel">
          <div className="admin-users-hero__metric">
            <span>Active on page</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="admin-users-hero__metric">
            <span>Inactive on page</span>
            <strong>{inactiveCount}</strong>
          </div>
          <div className="admin-users-hero__metric">
            <span>Admin on page</span>
            <strong>{adminCount}</strong>
          </div>
          <div className="admin-users-hero__metric">
            <span>Current page</span>
            <strong>{pageLabel}</strong>
          </div>
          <button className="primary-button admin-users-hero__button" disabled={isBusy || isSubmitting} onClick={openCreateModal} type="button">
            <PlusGlyph />
            Create user
          </button>
        </div>
      </section>

      {banner ? (
        <section className={`admin-users-banner admin-users-banner--${banner.tone}`} role="status">
          <div>
            <strong>{banner.title}</strong>
            <p>{banner.message}</p>
            {banner.secret ? (
              <div className="admin-users-banner__secret-row">
                <code className="admin-users-banner__secret">{banner.secret}</code>
                <button className="secondary-button" onClick={handleCopySecret} type="button">
                  Copy password
                </button>
              </div>
            ) : null}
          </div>
          <button className="admin-users-banner__close" onClick={handleDismissBanner} type="button">
            Dismiss
          </button>
        </section>
      ) : null}

      <section className="analytics-filter-container admin-users-filters">
        <form className="analytics-filter" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Search users</span>
            <div className="admin-users-search">
              <SearchGlyph />
              <input
                placeholder="Name, email, or role..."
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'ALL' | AppRole)}>
              {ROLE_FILTER_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role === 'ALL' ? 'All roles' : formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | AdminUserStatus)}>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Page size</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} rows
                </option>
              ))}
            </select>
          </label>
          <div className="admin-users-filter__actions">
            <button className="secondary-button" disabled={isBusy || isSubmitting} onClick={() => {
              setSearch('')
              setRoleFilter('ALL')
              setStatusFilter('ALL')
              setPageSize(25)
            }} type="button">
              Reset filters
            </button>
            <button className="primary-button" disabled={isBusy || isSubmitting} onClick={openCreateModal} type="button">
              <PlusGlyph />
              Add user
            </button>
          </div>
        </form>
      </section>

      <section className="panel--flat admin-users-table-card">
        <div className="panel__header admin-users-table-card__header">
          <div>
            <h3>User directory</h3>
            <p className="muted">
              {totalUsers > 0
                ? `Showing ${pageStart}-${pageEnd} of ${totalUsers} users`
                : 'No records to display for the selected filters.'}
            </p>
          </div>
          <div className="admin-users-table-card__meta">
            <span className="badge">{pageLabel}</span>
            {isRefreshing ? (
              <span className="admin-users-refresh"><RefreshGlyph /> Refreshing</span>
            ) : null}
            <button className="secondary-button" disabled={isBusy || isSubmitting} onClick={() => void usersQuery.refetch()} type="button">
              Refresh
            </button>
          </div>
        </div>

        {usersQuery.isError ? (
          <div className="form-error">
            {(usersQuery.error as Error | undefined)?.message ?? 'Unable to load users.'}
          </div>
        ) : null}

        {isInitialLoading ? (
          <div className="admin-users-loading">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="admin-users-loading__row" />
            ))}
          </div>
        ) : (
          <div className="admin-users-table-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const currentUser = isSelfUser(user, currentUserId)
                  const toggleLabel = user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'
                  const rowIsBusy = rowAction?.userId === user.id

                  return (
                    <tr key={user.id} className={currentUser ? 'admin-users-table__row--self' : undefined}>
                      <td>
                        <div className="admin-users-cell-stack">
                          <strong>{user.name}</strong>
                          <span>{user.id}{currentUser ? ' · You' : ''}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-users-cell-stack">
                          <strong>{user.email}</strong>
                          {user.loginEmail !== user.email ? <span>Login: {user.loginEmail}</span> : null}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-users-badge admin-users-badge--role-${user.role.toLowerCase()}`}>
                          {formatRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-users-badge admin-users-badge--${user.status === 'ACTIVE' ? 'success' : 'danger'}`}>
                          {formatStatusLabel(user.status)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-users-actions">
                          <button
                            className="admin-users-action-btn"
                            disabled={isBusy}
                            onClick={() => openEditModal(user, 'edit')}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="admin-users-action-btn"
                            disabled={isBusy}
                            onClick={() => openEditModal(user, 'role')}
                            type="button"
                          >
                            Change role
                          </button>
                          <button
                            className="admin-users-action-btn"
                            disabled={isBusy}
                            onClick={() => void handleToggleStatus(user)}
                            type="button"
                          >
                            {rowIsBusy && rowAction?.action === 'status' ? 'Updating...' : toggleLabel}
                          </button>
                          <button
                            className="admin-users-action-btn"
                            disabled={isBusy}
                            onClick={() => void handleResetPassword(user)}
                            type="button"
                          >
                            {rowIsBusy && rowAction?.action === 'reset' ? 'Resetting...' : 'Reset password'}
                          </button>
                          <button
                            className="admin-users-action-btn admin-users-action-btn--danger"
                            disabled={isBusy || currentUser}
                            onClick={() => void handleDelete(user)}
                            type="button"
                            title={currentUser ? 'You cannot delete yourself.' : undefined}
                          >
                            {rowIsBusy && rowAction?.action === 'delete' ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {emptyState}

        <div className="admin-users-pagination">
          <div className="admin-users-pagination__meta">
            <strong>{pageLabel}</strong>
            <span>
              {totalUsers > 0 ? `Rows ${pageStart}-${pageEnd}` : 'No rows selected'}
            </span>
          </div>
          <div className="admin-users-pagination__controls">
            <button
              className="secondary-button"
              disabled={page <= 0 || totalPages === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={totalPages === 0 || page >= totalPages - 1}
              onClick={() => setPage((current) => Math.min(Math.max(totalPages - 1, 0), current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {modalMode ? (
        <div
          className="admin-users-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
          role="presentation"
        >
          <div className="admin-users-modal__card" role="dialog" aria-modal="true" aria-label="Admin user form">
            <div className="admin-users-modal__header">
              <div>
                <span className="admin-users-modal__eyebrow">
                  {modalMode === 'create' ? 'Create user' : modalMode === 'role' ? 'Change role' : 'Edit user'}
                </span>
                <h3>{modalMode === 'create' ? 'Create a new account' : modalMode === 'role' ? 'Adjust the account role' : 'Edit the user profile'}</h3>
                <p>
                  {modalMode === 'create'
                    ? 'New users are created with a generated temporary password.'
                    : 'Name, email, and role are validated before the record is saved.'}
                </p>
              </div>
              <button className="admin-users-modal__close" onClick={closeModal} type="button">
                Close
              </button>
            </div>

            <form className="admin-users-form" onSubmit={handleSubmit}>
              <div className="admin-users-form__grid">
                <label className="input-group">
                  <span>Name</span>
                  <input
                    autoFocus
                    onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                    required
                    type="text"
                    value={formState.name}
                  />
                </label>
                <label className="input-group">
                  <span>Email</span>
                  <input
                    onChange={(event) => setFormState({ ...formState, email: event.target.value })}
                    required
                    type="email"
                    value={formState.email}
                  />
                </label>
                <label className="input-group">
                  <span>Role</span>
                  <select
                    onChange={(event) => setFormState({ ...formState, role: event.target.value as AppRole })}
                    required
                    value={formState.role}
                  >
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {modalMode !== 'create' ? (
                <div className="admin-users-modal__status-note">
                  <strong>Status:</strong> {formState.active ? 'Active' : 'Inactive'}
                  <p>The status action lives in the table so it can be toggled without reopening the modal.</p>
                </div>
              ) : null}

              {modalError ? <div className="form-error">{modalError}</div> : null}

              <div className="form-actions">
                <button className="primary-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create user' : 'Save changes'}
                </button>
                <button className="secondary-button" disabled={isSubmitting} onClick={closeModal} type="button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
