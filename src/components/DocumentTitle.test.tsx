import { render } from '@testing-library/react';
import { DocumentTitle } from './DocumentTitle';

function Layout({ page }: { page: boolean }) {
  return (
    <>
      <DocumentTitle title="Défis · Sport Challenge" />
      {page && <DocumentTitle title="Landing" />}
    </>
  );
}

describe('DocumentTitle', () => {
  it('lets a page override the layout, and gives the layout its title back', () => {
    const { rerender } = render(<Layout page />);
    expect(document.title).toBe('Landing');

    rerender(<Layout page={false} />);
    expect(document.title).toBe('Défis · Sport Challenge');
  });
});
