import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, keywords, canonical }) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
    </Helmet>
  );
}