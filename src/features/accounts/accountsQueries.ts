import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffRole } from "@/core/session/roles";
import { createAccount, deleteAccount, listAccounts, updateAccountRole } from "./accountsApi";

const ACCOUNTS_KEY = ["accounts"] as const;

export const useAccounts = (page: number) =>
  useQuery({
    queryKey: [...ACCOUNTS_KEY, page],
    queryFn: ({ signal }) => listAccounts(page, signal),
    placeholderData: keepPreviousData,
  });

const useInvalidateAccounts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
};

export const useCreateAccount = () => {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: createAccount, onSuccess: invalidate });
};

export const useUpdateAccountRole = () => {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ accountId, role }: { accountId: string; role: StaffRole | null }) =>
      updateAccountRole(accountId, role),
    onSuccess: invalidate,
  });
};

export const useDeleteAccount = () => {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: deleteAccount, onSuccess: invalidate });
};
