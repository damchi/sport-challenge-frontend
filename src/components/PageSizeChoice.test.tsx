import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { PageSizeChoice } from './PageSizeChoice';

afterEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('PageSizeChoice', () => {
  it('offers 10, 50 or all as radio buttons, under « Afficher »', () => {
    const onChange = vi.fn();
    render(<PageSizeChoice size="10" onChange={onChange} />);

    const group = screen.getByRole('group', { name: 'Afficher' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '10' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '50' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Tout' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('is translated in English', async () => {
    await i18n.changeLanguage('en');
    render(<PageSizeChoice size="all" onChange={() => undefined} />);

    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });
});
