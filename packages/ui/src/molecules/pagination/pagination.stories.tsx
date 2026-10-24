import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination.js';

const meta = {
  title: 'Molecules/Pagination',
  component: Pagination,
  args: { label: 'Paginación' },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Pagination {...args}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" label="Anterior" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis label="Más páginas" />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" label="Siguiente" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
