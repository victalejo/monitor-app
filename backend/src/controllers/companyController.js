import Company from '../models/Company.js';

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll();

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const stats = await Company.getStats(company.id);
        return { ...company, stats };
      })
    );

    res.json({ success: true, companies: companiesWithStats });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const stats = await Company.getStats(id);
    res.json({ success: true, company: { ...company, stats } });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCompany = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await Company.create(name, description);
    res.status(201).json({ success: true, company });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const company = await Company.update(id, name, description);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ success: true, company });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.delete(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
