import charusatLogo from '../../assets/charusat-logo.png';
import cdpcLogo from '../../assets/cdpc-logo.png';

const Footer = () => {
  return (
    <footer className="bg-surface-container-low border-t border-outline-variant mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-sm md:px-lg py-sm max-w-container-max mx-auto gap-sm">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          © {new Date().getFullYear()} The Placement Feed. All rights reserved.
        </p>
        {/* Both logos share the same height so they sit as visual peers.
            max-w caps prevent CHARUSAT's extreme aspect ratio from dominating. */}
        <div className="flex items-center mt-xs md:mt-0">
          <div className="w-32 flex justify-end">
            <img
              src={charusatLogo}
              alt="CHARUSAT — Charotar University of Science and Technology"
              className="h-6 w-auto object-contain"
            />
          </div>
          <div className="h-6 w-px bg-outline-variant mx-md"></div>
          <div className="w-32 flex justify-start">
            <img
              src={cdpcLogo}
              alt="CDPC — Career Development and Placement Cell"
              className="h-9 w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
